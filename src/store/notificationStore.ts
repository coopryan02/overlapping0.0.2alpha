
import { useState, useEffect, useCallback } from "react";
import { Notification } from "@/types";
import { notificationService } from "@/services/firebase";
import { onSnapshot, query, where, orderBy, collection } from "firebase/firestore";
import { db } from "@/config/firebase";

export const useNotificationStore = (userId?: string) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const userNotifications = await notificationService.getNotifications(userId);
      // Ensure we always set an array
      setNotifications(Array.isArray(userNotifications) ? userNotifications : []);
    } catch (err) {
      console.error("Error loading notifications:", err);
      setError(err instanceof Error ? err.message : "Failed to load notifications");
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Set up real-time listener for notifications
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    console.log("Setting up notifications listener for user:", userId);
    setIsLoading(true);
    setError(null);

    let unsubscribe: () => void = () => {};

    // Add a delay to ensure Firebase indexes are ready
    const setupListener = async () => {
      try {
        // Wait for potential index creation
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const notificationsRef = collection(db, "notifications");
        
        // Try a simple query first, then add ordering if it works
        let q;
        try {
          q = query(
            notificationsRef,
            where("userId", "==", userId),
            orderBy("createdAt", "desc")
          );
        } catch (indexError) {
          console.warn("Ordered query failed, falling back to simple query:", indexError);
          // Fallback to simple query without ordering
          q = query(
            notificationsRef,
            where("userId", "==", userId)
          );
        }

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            try {
              console.log("Notifications snapshot received, docs count:", snapshot.docs.length);
              
              // Initialize as empty array - CRITICAL for preventing slice errors
              const userNotifications: Notification[] = [];
              
              snapshot.forEach((doc) => {
                try {
                  const data = doc.data();
                  console.log("Processing notification doc:", doc.id, data);
                  
                  // Validate document data exists and is an object
                  if (!data || typeof data !== 'object') {
                    console.warn("Invalid notification data for doc:", doc.id);
                    return;
                  }

                  // Ensure required fields exist
                  if (!data.userId || !data.type || !data.title) {
                    console.warn("Missing required fields in notification:", doc.id, data);
                    return;
                  }

                  // Process createdAt field safely
                  let createdAt = data.createdAt;
                  if (data.createdAt && typeof data.createdAt === 'object' && data.createdAt.toDate) {
                    // Firestore Timestamp
                    createdAt = data.createdAt.toDate().toISOString();
                  } else if (!createdAt) {
                    // Fallback to current time if no createdAt
                    createdAt = new Date().toISOString();
                  }

                  const notification: Notification = {
                    id: doc.id,
                    userId: data.userId,
                    type: data.type,
                    title: data.title,
                    message: data.message || '',
                    read: Boolean(data.read),
                    createdAt,
                    data: data.data || undefined
                  };

                  userNotifications.push(notification);
                } catch (docError) {
                  console.error("Error processing individual notification doc:", doc.id, docError);
                }
              });
              
              // Sort manually if we couldn't use orderBy
              userNotifications.sort((a, b) => {
                const dateA = new Date(a.createdAt).getTime();
                const dateB = new Date(b.createdAt).getTime();
                return dateB - dateA; // Descending order
              });
              
              console.log("Processed notifications:", userNotifications.length);
              
              // CRITICAL: Ensure we always set an array, never undefined/null
              setNotifications(Array.isArray(userNotifications) ? userNotifications : []);
              setIsLoading(false);
              setError(null);
            } catch (processError) {
              console.error("Error processing notifications snapshot:", processError);
              setError("Error processing notifications");
              setIsLoading(false);
              // Keep previous notifications on processing error, don't clear them
            }
          },
          (err) => {
            console.error("Notifications listener error:", err);
            setError(err.message || "Failed to listen to notifications");
            setIsLoading(false);
            
            // Fallback to one-time load if real-time fails
            console.log("Falling back to one-time notification load");
            loadNotifications().catch(fallbackError => {
              console.error("Fallback notification load also failed:", fallbackError);
            });
          }
        );
      } catch (setupError) {
        console.error("Error setting up notifications listener:", setupError);
        setError("Failed to set up notifications listener");
        setIsLoading(false);
        
        // Fallback to one-time load if setup fails
        loadNotifications().catch(fallbackError => {
          console.error("Fallback notification load failed:", fallbackError);
        });
      }
    };

    // Call the async setup function
    setupListener();

    // Cleanup function
    return () => {
      console.log("Cleaning up notifications listener");
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (cleanupError) {
          console.error("Error during notifications listener cleanup:", cleanupError);
        }
      }
    };
  }, [userId, loadNotifications]);

  const markAsRead = async (notificationId: string): Promise<void> => {
    try {
      await notificationService.markAsRead(notificationId);
      // Optimistic update - real-time listener will sync the actual state
      setNotifications((prev) =>
        Array.isArray(prev) ? prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification,
        ) : []
      );
    } catch (err) {
      console.error("Error marking notification as read:", err);
      setError(err instanceof Error ? err.message : "Failed to mark notification as read");
      throw err;
    }
  };

  const markAllAsRead = async (): Promise<void> => {
    if (!userId) return;

    try {
      const unreadNotifications = Array.isArray(notifications)
        ? notifications.filter((n) => !n.read)
        : [];
        
      await Promise.all(
        unreadNotifications.map((notification) =>
          notificationService.markAsRead(notification.id)
        )
      );

      // Optimistic update - real-time listener will sync the actual state
      setNotifications((prev) =>
        Array.isArray(prev) ? prev.map((notification) => ({ ...notification, read: true })) : []
      );
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
      setError(err instanceof Error ? err.message : "Failed to mark all notifications as read");
      throw err;
    }
  };

  const getUnreadCount = (): number => {
    if (!Array.isArray(notifications)) return 0;
    return notifications.filter((notification) => !notification.read).length;
  };

  const getNotificationsByType = (
    type: Notification["type"],
  ): Notification[] => {
    if (!Array.isArray(notifications)) return [];
    return notifications.filter((notification) => notification.type === type);
  };

  const deleteNotification = async (notificationId: string): Promise<void> => {
    try {
      await notificationService.deleteNotification(notificationId);
      // Optimistic update - real-time listener will sync the actual state
      setNotifications((prev) =>
        Array.isArray(prev) ? prev.filter((n) => n.id !== notificationId) : []
      );
    } catch (err) {
      console.error("Error deleting notification:", err);
      setError(err instanceof Error ? err.message : "Failed to delete notification");
      throw err;
    }
  };

  const clearAllNotifications = async (): Promise<void> => {
    if (!userId) return;

    try {
      await notificationService.clearAllNotifications(userId);
      // Optimistic update - real-time listener will sync the actual state
      setNotifications([]);
    } catch (err) {
      console.error("Error clearing all notifications:", err);
      setError(err instanceof Error ? err.message : "Failed to clear all notifications");
      throw err;
    }
  };

  const createNotification = async (notification: Omit<Notification, "id" | "createdAt">): Promise<void> => {
    try {
      await notificationService.createNotification(notification);
      // Real-time listener will automatically update the state
    } catch (err) {
      console.error("Error creating notification:", err);
      setError(err instanceof Error ? err.message : "Failed to create notification");
      throw err;
    }
  };

  const refreshNotifications = async (): Promise<void> => {
    await loadNotifications();
  };

  const clearError = (): void => {
    setError(null);
  };

  return {
    notifications: Array.isArray(notifications) ? notifications : [],
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    getNotificationsByType,
    deleteNotification,
    clearAllNotifications,
    createNotification,
    loadNotifications: refreshNotifications,
    clearError,
  };
};