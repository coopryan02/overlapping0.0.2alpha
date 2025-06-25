import { useState, useEffect, useCallback } from "react";
import { Message, Conversation, User, Notification } from "@/types";
import {
  conversationService,
  userService,
  notificationService,
} from "@/services/firebase";
import { generateId } from "@/utils/auth";

export const useMessageStore = (userId?: string) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    if (!userId) {
      setConversations([]);
      setIsLoading(false);
      return;
    }

    try {
      console.log("Loading conversations for user:", userId);
      setIsLoading(true);
      setError(null);
      
      const allConversations = await conversationService.getAll();
      console.log("Retrieved all conversations:", allConversations.length);
      
      // Ensure we have valid data
      if (!Array.isArray(allConversations)) {
        console.warn("conversationService.getAll() did not return an array");
        setConversations([]);
        setIsLoading(false);
        return;
      }

      const userConversations = allConversations.filter((conv) => {
        // Validate conversation structure
        if (!conv || typeof conv !== 'object') {
          console.warn("Invalid conversation object:", conv);
          return false;
        }

        // Ensure participants is an array
        if (!Array.isArray(conv.participants)) {
          console.warn("Conversation participants is not an array:", conv.id, conv.participants);
          return false;
        }

        return conv.participants.includes(userId);
      });

      console.log("Filtered user conversations:", userConversations.length);

      // Sort by last message timestamp with safe date handling
      userConversations.sort((a, b) => {
        try {
          const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          
          // Check for invalid dates
          if (isNaN(timeA) || isNaN(timeB)) {
            console.warn("Invalid date in conversation sort:", { a: a.updatedAt, b: b.updatedAt });
            return 0;
          }
          
          return timeB - timeA;
        } catch (sortError) {
          console.error("Error sorting conversations:", sortError);
          return 0;
        }
      });

      setConversations(userConversations);
      console.log("Successfully loaded conversations");
    } catch (err) {
      console.error("Error loading conversations:", err);
      setError(err instanceof Error ? err.message : "Failed to load conversations");
      setConversations([]); // Set empty array on error
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const sendMessage = async (receiverId: string, content: string): Promise<Message> => {
    if (!userId) throw new Error("User ID is required");
    if (!receiverId) throw new Error("Receiver ID is required");
    if (!content || !content.trim()) throw new Error("Message content is required");

    try {
      setError(null);

      const message: Message = {
        id: generateId(),
        senderId: userId,
        receiverId,
        content: content.trim(),
        timestamp: new Date().toISOString(),
        read: false,
      };

      console.log("Sending message:", message);

      // Add message to conversation
      const messageAdded = await conversationService.addMessage(message);
      if (!messageAdded) {
        throw new Error("Failed to add message to conversation");
      }
      
      // Refresh conversations
      await loadConversations();

      // Create notification for receiver (non-blocking)
      try {
        const allUsers = await userService.getAll();
        
        if (!Array.isArray(allUsers)) {
          console.warn("userService.getAll() did not return an array");
        } else {
          const sender = allUsers.find((u) => u && u.id === userId);
          
          if (sender && sender.fullName) {
            const notification: Notification = {
              id: generateId(),
              userId: receiverId,
              type: "message",
              title: "New Message",
              message: `${sender.fullName} sent you a message`,
              data: {
                senderId: userId,
                messageId: message.id,
              },
              read: false,
              createdAt: new Date().toISOString(),
            };

            const notificationCreated = await notificationService.create(notification);
            if (!notificationCreated) {
              console.warn("Failed to create notification, but message was sent successfully");
            }
          } else {
            console.warn("Sender not found or missing fullName:", sender);
          }
        }
      } catch (notifError) {
        console.error("Error creating notification:", notifError);
        // Don't throw here - message was sent successfully
      }

      console.log("Message sent successfully");
      return message;
    } catch (err) {
      console.error("Error sending message:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to send message";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const getConversation = (participantId: string): Conversation | null => {
    if (!userId || !participantId) return null;

    try {
      if (!Array.isArray(conversations)) {
        console.warn("Conversations is not an array in getConversation");
        return null;
      }

      return (
        conversations.find(
          (conv) =>
            conv &&
            Array.isArray(conv.participants) &&
            conv.participants.includes(participantId) &&
            conv.participants.includes(userId),
        ) || null
      );
    } catch (err) {
      console.error("Error getting conversation:", err);
      return null;
    }
  };

  const markMessagesAsRead = async (conversationId: string): Promise<void> => {
    if (!conversationId || !userId) {
      throw new Error("Conversation ID and User ID are required");
    }

    try {
      setError(null);
      
      if (!Array.isArray(conversations)) {
        console.warn("Conversations is not an array in markMessagesAsRead");
        return;
      }
      
      const conversation = conversations.find(
        (conv) => conv && conv.id === conversationId,
      );
      
      if (!conversation) {
        console.warn("Conversation not found:", conversationId);
        return;
      }

      // Ensure messages is an array
      if (!Array.isArray(conversation.messages)) {
        console.warn("Conversation messages is not an array:", conversation.id);
        return;
      }

      let hasUnreadMessages = false;
      const updatedMessages = conversation.messages.map((message) => {
        // Validate message object
        if (!message || typeof message !== 'object') {
          console.warn("Invalid message object:", message);
          return message;
        }

        if (message.receiverId === userId && !message.read) {
          hasUnreadMessages = true;
          return { ...message, read: true };
        }
        return message;
      });

      if (hasUnreadMessages) {
        const updatedConversation = {
          ...conversation,
          messages: updatedMessages,
        };

        const updateSuccess = await conversationService.update(conversationId, updatedConversation);
        if (updateSuccess) {
          await loadConversations();
        } else {
          throw new Error("Failed to update conversation");
        }
      }
    } catch (err) {
      console.error("Error marking messages as read:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to mark messages as read";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const getUnreadCount = (conversationId: string): number => {
    try {
      if (!conversationId || !userId || !Array.isArray(conversations)) {
        return 0;
      }

      const conversation = conversations.find(
        (conv) => conv && conv.id === conversationId,
      );
      
      if (!conversation || !Array.isArray(conversation.messages)) {
        return 0;
      }

      return conversation.messages.filter(
        (message) =>
          message &&
          typeof message === 'object' &&
          message.receiverId === userId &&
          !message.read,
      ).length;
    } catch (err) {
      console.error("Error getting unread count:", err);
      return 0;
    }
  };

  const getTotalUnreadCount = (): number => {
    try {
      if (!Array.isArray(conversations)) {
        return 0;
      }

      return conversations.reduce(
        (total, conversation) => {
          if (!conversation || !conversation.id) {
            return total;
          }
          return total + getUnreadCount(conversation.id);
        },
        0,
      );
    } catch (err) {
      console.error("Error getting total unread count:", err);
      return 0;
    }
  };

  const deleteConversation = async (conversationId: string): Promise<boolean> => {
    if (!conversationId || !userId) {
      console.error("Conversation ID and User ID are required for deletion");
      return false;
    }

    try {
      setError(null);
      
      if (!Array.isArray(conversations)) {
        console.warn("Conversations is not an array in deleteConversation");
        return false;
      }
      
      const conversation = conversations.find(
        (conv) => conv && conv.id === conversationId,
      );
      
      if (!conversation) {
        console.warn("Conversation not found for deletion:", conversationId);
        return false;
      }

      if (!Array.isArray(conversation.participants) || !conversation.participants.includes(userId)) {
        console.warn("User not authorized to delete conversation:", conversationId);
        return false;
      }

      const deleteSuccess = await conversationService.delete(conversationId);
      if (deleteSuccess) {
        await loadConversations();
        return true;
      } else {
        throw new Error("Failed to delete conversation");
      }
    } catch (err) {
      console.error("Error deleting conversation:", err);
      setError(err instanceof Error ? err.message : "Failed to delete conversation");
      return false;
    }
  };

  const getConversationWithUser = (otherUserId: string): Conversation | null => {
    if (!userId || !otherUserId) return null;

    try {
      if (!Array.isArray(conversations)) {
        console.warn("Conversations is not an array in getConversationWithUser");
        return null;
      }

      const conversationId = [userId, otherUserId].sort().join("-");
      return conversations.find((conv) => conv && conv.id === conversationId) || null;
    } catch (err) {
      console.error("Error getting conversation with user:", err);
      return null;
    }
  };

  const createConversation = async (otherUserId: string): Promise<Conversation> => {
    if (!userId) throw new Error("User ID is required");
    if (!otherUserId) throw new Error("Other user ID is required");
    if (userId === otherUserId) throw new Error("Cannot create conversation with yourself");

    try {
      setError(null);
      
      const conversationId = [userId, otherUserId].sort().join("-");

      // Check if conversation already exists
      const existingConversation = getConversationWithUser(otherUserId);
      if (existingConversation) {
        console.log("Conversation already exists:", conversationId);
        return existingConversation;
      }

      const newConversation: Conversation = {
        id: conversationId,
        participants: [userId, otherUserId],
        messages: [],
        updatedAt: new Date().toISOString(),
      };

      console.log("Creating new conversation:", newConversation);

      const createSuccess = await conversationService.create(newConversation);
      if (!createSuccess) {
        throw new Error("Failed to create conversation in database");
      }

      await loadConversations();
      
      // Return the conversation from our local state after refresh
      const createdConversation = getConversationWithUser(otherUserId);
      if (!createdConversation) {
        throw new Error("Failed to retrieve created conversation");
      }
      
      console.log("Conversation created successfully:", createdConversation.id);
      return createdConversation;
    } catch (err) {
      console.error("Error creating conversation:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to create conversation";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Real-time conversation updates (optional enhancement)
  const subscribeToConversations = useCallback(() => {
    if (!userId) return;

    // This would set up a real-time listener for conversations
    // Implementation depends on your Firebase service setup
    // Example: return conversationService.subscribeToUserConversations(userId, setConversations);
    console.log("Real-time conversation subscription not implemented yet");
  }, [userId]);

  // Clean up error state
  const clearError = () => setError(null);

  return {
    conversations: Array.isArray(conversations) ? conversations : [],
    isLoading,
    error,
    sendMessage,
    getConversation,
    markMessagesAsRead,
    getUnreadCount,
    getTotalUnreadCount,
    deleteConversation,
    getConversationWithUser,
    createConversation,
    loadConversations,
    subscribeToConversations,
    clearError,
  };
};