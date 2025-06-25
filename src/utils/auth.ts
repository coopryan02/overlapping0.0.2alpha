// src/utils/auth.ts
import { User } from "@/types";
import {
  searchUsers as firebaseSearchUsers,
  sendFriendRequest as firebaseSendFriendRequest,
  acceptFriendRequest as firebaseAcceptFriendRequest,
  rejectFriendRequest as firebaseRejectFriendRequest,
} from "@/services/firebase";

// Validation utilities (keeping these as they're still useful)
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (
  password: string,
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Firebase-based user functions
export const searchUsers = async (query: string, currentUserId: string): Promise<User[]> => {
  return await firebaseSearchUsers(query, currentUserId);
};

export const sendFriendRequest = async (
  fromUserId: string,
  toUserId: string,
): Promise<boolean> => {
  return await firebaseSendFriendRequest(fromUserId, toUserId);
};

export const acceptFriendRequest = async (
  userId: string,
  requesterId: string,
): Promise<boolean> => {
  return await firebaseAcceptFriendRequest(userId, requesterId);
};

export const rejectFriendRequest = async (
  userId: string,
  requesterId: string,
): Promise<boolean> => {
  return await firebaseRejectFriendRequest(userId, requesterId);
};

// Deprecated functions (kept for backward compatibility)
export const generateId = (): string => {
  console.warn("generateId() is deprecated. Firebase generates IDs automatically.");
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

export const hashPassword = (password: string): string => {
  console.warn("hashPassword() is deprecated. Firebase Auth handles password hashing.");
  // Simple hash for demo purposes - Firebase handles this now
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
};

export const createUser = (
  email: string,
  password: string,
  username: string,
  fullName: string,
): User => {
  console.warn("createUser() is deprecated. Use createUserAccount() from Firebase services.");
  return {
    id: generateId(),
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
};

export const authenticateUser = (
  email: string,
  password: string,
): User | null => {
  console.warn("authenticateUser() is deprecated. Use signInUser() from Firebase services.");
  return null;
};

export const registerUser = (
  email: string,
  password: string,
  username: string,
  fullName: string,
): { success: boolean; error?: string; user?: User } => {
  console.warn("registerUser() is deprecated. Use createUserAccount() from Firebase services.");
  return { success: false, error: "This function is deprecated. Use Firebase services." };
};