// src/services/firebase.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
  addDoc,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { User, Event, Message, Conversation, Notification } from '@/types';

// Helper function to generate IDs
const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

// User Authentication Functions
export const createUserAccount = async (
  email: string,
  password: string,
  username: string,
  fullName: string
): Promise<{ success: boolean; error?: string; user?: User }> => {
  try {
    // Check if username already exists
    const usernameQuery = query(
      collection(db, 'users'),
      where('username', '==', username.toLowerCase())
    );
    const usernameSnapshot = await getDocs(usernameQuery);
    
    if (!usernameSnapshot.empty) {
      return { success: false, error: 'Username already exists' };
    }

    // Create Firebase auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Update Firebase auth profile
    await updateProfile(firebaseUser, { displayName: fullName });

    // Create user document in Firestore
    const userData: User = {
      id: firebaseUser.uid,
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      fullName,
      friends: [],
      friendRequests: {
        sent: [],
        received: [],
      },
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), userData);

    return { success: true, user: userData };
  } catch (error: any) {
    console.error('Create user error:', error);
    return { success: false, error: error.message };
  }
};

export const signInUser = async (
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: User }> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Get user data from Firestore
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    
    if (!userDoc.exists()) {
      throw new Error('User data not found');
    }

    const userData = userDoc.data() as User;
    return { success: true, user: userData };
  } catch (error: any) {
    console.error('Sign in error:', error);
    return { success: false, error: error.message };
  }
};

export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          callback(userData);
        } else {
          callback(null);
        }
      } catch (error) {
        console.error('Error getting user data:', error);
        callback(null);
      }
    } else {
      callback(null);
    }
  });
};

// User Management Functions
export const searchUsers = async (query: string, currentUserId: string): Promise<User[]> => {
  try {
    const searchTerm = query.toLowerCase().trim();
    if (!searchTerm) return [];

    // Search by username
    const usernameQuery = query(
      collection(db, 'users'),
      where('username', '>=', searchTerm),
      where('username', '<=', searchTerm + '\uf8ff'),
      limit(10)
    );

    // Search by full name (you might want to implement a more sophisticated search)
    const nameQuery = query(
      collection(db, 'users'),
      where('fullName', '>=', searchTerm),
      where('fullName', '<=', searchTerm + '\uf8ff'),
      limit(10)
    );

    const [usernameSnapshot, nameSnapshot] = await Promise.all([
      getDocs(usernameQuery),
      getDocs(nameQuery)
    ]);

    const users = new Map<string, User>();

    // Combine results and remove duplicates
    [...usernameSnapshot.docs, ...nameSnapshot.docs].forEach(doc => {
      const userData = doc.data() as User;
      if (userData.id !== currentUserId) {
        users.set(userData.id, userData);
      }
    });

    return Array.from(users.values());
  } catch (error) {
    console.error('Search users error:', error);
    return [];
  }
};

export const sendFriendRequest = async (fromUserId: string, toUserId: string): Promise<boolean> => {
  try {
    const batch = writeBatch(db);

    // Update sender's sent requests
    const fromUserRef = doc(db, 'users', fromUserId);
    batch.update(fromUserRef, {
      'friendRequests.sent': arrayUnion(toUserId)
    });

    // Update receiver's received requests
    const toUserRef = doc(db, 'users', toUserId);
    batch.update(toUserRef, {
      'friendRequests.received': arrayUnion(fromUserId)
    });

    // Create notification
    const notification: Omit<Notification, 'id'> = {
      userId: toUserId,
      type: 'friend_request',
      title: 'New Friend Request',
      message: 'You have a new friend request',
      read: false,
      createdAt: new Date().toISOString(),
      data: { fromUserId }
    };

    const notificationRef = doc(collection(db, 'notifications'));
    batch.set(notificationRef, { ...notification, id: notificationRef.id });

    await batch.commit();
    return true;
  } catch (error) {
    console.error('Send friend request error:', error);
    return false;
  }
};

export const acceptFriendRequest = async (userId: string, requesterId: string): Promise<boolean> => {
  try {
    const batch = writeBatch(db);

    // Update both users
    const userRef = doc(db, 'users', userId);
    const requesterRef = doc(db, 'users', requesterId);

    batch.update(userRef, {
      'friendRequests.received': arrayRemove(requesterId),
      'friends': arrayUnion(requesterId)
    });

    batch.update(requesterRef, {
      'friendRequests.sent': arrayRemove(userId),
      'friends': arrayUnion(userId)
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error('Accept friend request error:', error);
    return false;
  }
};

export const rejectFriendRequest = async (userId: string, requesterId: string): Promise<boolean> => {
  try {
    const batch = writeBatch(db);

    const userRef = doc(db, 'users', userId);
    const requesterRef = doc(db, 'users', requesterId);

    batch.update(userRef, {
      'friendRequests.received': arrayRemove(requesterId)
    });

    batch.update(requesterRef, {
      'friendRequests.sent': arrayRemove(userId)
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error('Reject friend request error:', error);
    return false;
  }
};

// Event Functions
export const createEvent = async (event: Omit<Event, 'id'>): Promise<string | null> => {
  try {
    const eventRef = doc(collection(db, 'events'));
    const eventData = { ...event, id: eventRef.id };
    await setDoc(eventRef, eventData);
    return eventRef.id;
  } catch (error) {
    console.error('Create event error:', error);
    return null;
  }
};

export const getUserEvents = async (userId: string): Promise<Event[]> => {
  try {
    const eventsQuery = query(
      collection(db, 'events'),
      where('createdBy', '==', userId),
      orderBy('date', 'desc')
    );
    
    const snapshot = await getDocs(eventsQuery);
    return snapshot.docs.map(doc => doc.data() as Event);
  } catch (error) {
    console.error('Get user events error:', error);
    return [];
  }
};

export const updateEvent = async (eventId: string, updates: Partial<Event>): Promise<boolean> => {
  try {
    await updateDoc(doc(db, 'events', eventId), updates);
    return true;
  } catch (error) {
    console.error('Update event error:', error);
    return false;
  }
};

// Message Functions
export const sendMessage = async (message: Omit<Message, 'id'>): Promise<boolean> => {
  try {
    const conversationId = [message.senderId, message.receiverId].sort().join('-');
    
    // Add message to messages collection
    const messageRef = doc(collection(db, 'messages'));
    const messageData = { ...message, id: messageRef.id };
    await setDoc(messageRef, messageData);

    // Update or create conversation
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);

    const conversationData: Conversation = {
      id: conversationId,
      participants: [message.senderId, message.receiverId],
      messages: [], // We'll load messages separately for better performance
      lastMessage: messageData,
      updatedAt: message.timestamp,
    };

    if (conversationDoc.exists()) {
      await updateDoc(conversationRef, {
        lastMessage: messageData,
        updatedAt: message.timestamp,
      });
    } else {
      await setDoc(conversationRef, conversationData);
    }

    return true;
  } catch (error) {
    console.error('Send message error:', error);
    return false;
  }
};

export const getUserConversations = async (userId: string): Promise<Conversation[]> => {
  try {
    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );

    const snapshot = await getDocs(conversationsQuery);
    return snapshot.docs.map(doc => doc.data() as Conversation);
  } catch (error) {
    console.error('Get conversations error:', error);
    return [];
  }
};

export const getConversationMessages = async (conversationId: string): Promise<Message[]> => {
  try {
    const messagesQuery = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId),
      orderBy('timestamp', 'asc')
    );

    const snapshot = await getDocs(messagesQuery);
    return snapshot.docs.map(doc => doc.data() as Message);
  } catch (error) {
    console.error('Get messages error:', error);
    return [];
  }
};

// Notification Functions
export const getUserNotifications = async (userId: string): Promise<Notification[]> => {
  try {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const snapshot = await getDocs(notificationsQuery);
    return snapshot.docs.map(doc => doc.data() as Notification);
  } catch (error) {
    console.error('Get notifications error:', error);
    return [];
  }
};

export const markNotificationAsRead = async (notificationId: string): Promise<boolean> => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
    return true;
  } catch (error) {
    console.error('Mark notification as read error:', error);
    return false;
  }
};

// Real-time listeners
export const subscribeToUserNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void
) => {
  const notificationsQuery = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(notificationsQuery, (snapshot) => {
    const notifications = snapshot.docs.map(doc => doc.data() as Notification);
    callback(notifications);
  });
};

export const subscribeToConversationMessages = (
  conversationId: string,
  callback: (messages: Message[]) => void
) => {
  const messagesQuery = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId),
    orderBy('timestamp', 'asc')
  );

  return onSnapshot(messagesQuery, (snapshot) => {
    const messages = snapshot.docs.map(doc => doc.data() as Message);
    callback(messages);
  });
};