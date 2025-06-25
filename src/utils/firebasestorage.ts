// src/utils/firebaseStorage.ts
import { User, Event, Message, Conversation, Notification } from "@/types";
import {
  searchUsers as firebaseSearchUsers,
  sendFriendRequest as firebaseSendFriendRequest,
  acceptFriendRequest as firebaseAcceptFriendRequest,
  rejectFriendRequest as firebaseRejectFriendRequest,
  createEvent,
  getUserEvents,
  updateEvent as firebaseUpdateEvent,
  sendMessage,
  getUserConversations,
  getConversationMessages,
  getUserNotifications,
  markNotificationAsRead,
  subscribeToUserNotifications,
  subscribeToConversationMessages,
} from "@/services/firebase";

// User storage utilities (Firebase-based)
export const userStorage = {
  // Note: Users are now managed through Firebase Auth and Firestore
  // These methods are kept for compatibility but should use Firebase functions
  
  getUsers: async (): Promise<User[]> => {
    // This method is less relevant now since we search users differently
    // You might want to implement a different approach for admin functions
    console.warn("getUsers() is deprecated. Use searchUsers() instead.");
    return [];
  },

  getCurrentUser: (): User | null => {
    // This should now come from the auth context
    console.warn("getCurrentUser() should use auth context instead");
    return null;
  },

  setCurrentUser: (user: User | null): void => {
    // This is now handled by Firebase Auth
    console.warn("setCurrentUser() is handled by Firebase Auth");
  },

  updateUser: async (updatedUser: User): Promise<void> => {
    // This would need to be implemented to update Firestore
    console.warn("updateUser() needs to be implemented for Firestore");
  },

  // New Firebase-based methods
  searchUsers: async (query: string, currentUserId: string): Promise<User[]> => {
    return await firebaseSearchUsers(query, currentUserId);
  },

  sendFriendRequest: async (fromUserId: string, toUserId: string): Promise<boolean> => {
    return await firebaseSendFriendRequest(fromUserId, toUserId);
  },

  acceptFriendRequest: async (userId: string, requesterId: string): Promise<boolean> => {
    return await firebaseAcceptFriendRequest(userId, requesterId);
  },

  rejectFriendRequest: async (userId: string, requesterId: string): Promise<boolean> => {
    return await firebaseRejectFriendRequest(userId, requesterId);
  },
};

// Event storage utilities (Firebase-based)
export const eventStorage = {
  getEvents: async (userId: string): Promise<Event[]> => {
    return await getUserEvents(userId);
  },

  addEvent: async (event: Omit<Event, 'id'>): Promise<string | null> => {
    return await createEvent(event);
  },

  updateEvent: async (eventId: string, updates: Partial<Event>): Promise<boolean> => {
    return await firebaseUpdateEvent(eventId, updates);
  },

  deleteEvent: async (eventId: string): Promise<boolean> => {
    // You'll need to implement this in the Firebase services
    console.warn("deleteEvent() needs to be implemented in Firebase services");
    return false;
  },
};

// Conversation storage utilities (Firebase-based)
export const conversationStorage = {
  getConversations: async (userId: string): Promise<Conversation[]> => {
    return await getUserConversations(userId);
  },

  addMessage: async (message: Omit<Message, 'id'>): Promise<boolean> => {
    return await sendMessage(message);
  },

  getMessages: async (conversationId: string): Promise<Message[]> => {
    return await getConversationMessages(conversationId);
  },

  // Real-time subscription
  subscribeToMessages: (
    conversationId: string,
    callback: (messages: Message[]) => void
  ) => {
    return subscribeToConversationMessages(conversationId, callback);
  },
};

// Notification storage utilities (Firebase-based)
export const notificationStorage = {
  getNotifications: async (userId: string): Promise<Notification[]> => {
    return await getUserNotifications(userId);
  },

  markAsRead: async (notificationId: string): Promise<boolean> => {
    return await markNotificationAsRead(notificationId);
  },

  // Real-time subscription
  subscribeToNotifications: (
    userId: string,
    callback: (notifications: Notification[]) => void
  ) => {
    return subscribeToUserNotifications(userId, callback);
  },
};

// Legacy storage interface for backward compatibility
export const storage = {
  get: <T>(key: string): T | null => {
    console.warn(`storage.get("${key}") is deprecated. Use Firebase functions instead.`);
    return null;
  },

  set: <T>(key: string, value: T): void => {
    console.warn(`storage.set("${key}") is deprecated. Use Firebase functions instead.`);
  },

  remove: (key: string): void => {
    console.warn(`storage.remove("${key}") is deprecated. Use Firebase functions instead.`);
  },

  clear: (): void => {
    console.warn("storage.clear() is deprecated. Firebase handles data persistence.");
  },
};