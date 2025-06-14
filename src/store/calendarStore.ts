import { useState, useEffect, useCallback } from "react";
import {
  Event,
  HangoutEvent,
  CreateEventInput,
  User,
  HangoutMatch,
  Notification,
} from "@/types";
import {
  eventStorage,
  userStorage,
  notificationStorage,
} from "@/utils/storage";
import { generateId } from "@/utils/auth";

export const useCalendarStore = (userId?: string) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadEvents = useCallback(() => {
    setIsLoading(true);
    const allEvents = eventStorage.getEvents();
    const userEvents = userId
      ? allEvents.filter((event) => event.userId === userId)
      : [];
    setEvents(userEvents);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const createEvent = (eventData: CreateEventInput): Event => {
    if (!userId) throw new Error("User ID is required");

    const newEvent: Event = {
      id: generateId(),
      userId,
      title: eventData.title,
      description: eventData.description,
      startTime: eventData.startTime,
      endTime: eventData.endTime,
      type: eventData.type,
      createdAt: new Date().toISOString(),
    };

    // Add hangout-specific properties
    if (eventData.type === "hangout" && eventData.preferences) {
      (newEvent as HangoutEvent).preferences = eventData.preferences;
      (newEvent as HangoutEvent).visibility = "friends";
    }

    eventStorage.addEvent(newEvent);
    setEvents((prev) => [...prev, newEvent]);

    // Check for hangout matches if this is a hangout event
    if (newEvent.type === "hangout") {
      checkForHangoutMatches(newEvent as HangoutEvent);
    }

    return newEvent;
  };

  const updateEvent = (eventId: string, updates: Partial<Event>): boolean => {
    const event = events.find((e) => e.id === eventId);
    if (!event || event.userId !== userId) return false;

    const updatedEvent = { ...event, ...updates };
    eventStorage.updateEvent(updatedEvent);
    setEvents((prev) => prev.map((e) => (e.id === eventId ? updatedEvent : e)));

    return true;
  };

  const deleteEvent = (eventId: string): boolean => {
    const event = events.find((e) => e.id === eventId);
    if (!event || event.userId !== userId) return false;

    eventStorage.deleteEvent(eventId);
    setEvents((prev) => prev.filter((e) => e.id !== eventId));

    return true;
  };

  const getFriendEvents = (friendId: string): Event[] => {
    const allEvents = eventStorage.getEvents();
    return allEvents.filter(
      (event) =>
        event.userId === friendId &&
        (event.type === "hangout" || event.type === "personal"),
    );
  };

  const getFriendHangouts = (friendId: string): HangoutEvent[] => {
    const allEvents = eventStorage.getEvents();
    return allEvents.filter(
      (event) => event.userId === friendId && event.type === "hangout",
    ) as HangoutEvent[];
  };

  const checkForHangoutMatches = (hangoutEvent: HangoutEvent) => {
    if (!userId) return;

    const currentUser = userStorage.getCurrentUser();
    if (!currentUser) return;

    const allEvents = eventStorage.getEvents();
    const friends = userStorage
      .getUsers()
      .filter((user) => currentUser.friends.includes(user.id));

    friends.forEach((friend) => {
      const friendHangouts = allEvents.filter(
        (event) => event.userId === friend.id && event.type === "hangout",
      ) as HangoutEvent[];

      friendHangouts.forEach((friendHangout) => {
        const overlap = getTimeOverlap(hangoutEvent, friendHangout);
        if (overlap) {
          // Check if notification already exists to avoid duplicates
          const existingNotifications = notificationStorage.getNotifications();
          const alreadyNotified = existingNotifications.some(
            (notification) =>
              notification.userId === userId &&
              notification.type === "hangout_match" &&
              notification.data?.hangoutEvents?.includes(hangoutEvent.id) &&
              notification.data?.hangoutEvents?.includes(friendHangout.id),
          );

          if (!alreadyNotified) {
            createHangoutMatch(hangoutEvent, friendHangout, overlap);
          }
        }
      });
    });
  };

  const getTimeOverlap = (
    event1: Event,
    event2: Event,
  ): { start: string; end: string } | null => {
    const start1 = new Date(event1.startTime);
    const end1 = new Date(event1.endTime);
    const start2 = new Date(event2.startTime);
    const end2 = new Date(event2.endTime);

    const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
    const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));

    // Check if there's any overlap, even if it's just 1 minute or less
    if (overlapStart <= overlapEnd) {
      return {
        start: overlapStart.toISOString(),
        end: overlapEnd.toISOString(),
      };
    }

    return null;
  };

  const createHangoutMatch = (
    event1: HangoutEvent,
    event2: HangoutEvent,
    overlap: { start: string; end: string },
  ) => {
    const users = [event1.userId, event2.userId];

    // Create notifications for both users
    users.forEach((userId) => {
      const otherUserId = users.find((id) => id !== userId);
      const otherUser = userStorage
        .getUsers()
        .find((u) => u.id === otherUserId);

      if (otherUser) {
        const notification: Notification = {
          id: generateId(),
          userId,
          type: "hangout_match",
          title: "Hangout Match Found!",
          message: `You and ${otherUser.fullName} have overlapping hangout times`,
          data: {
            matchedUserId: otherUserId,
            overlappingTime: overlap,
            hangoutEvents: [event1.id, event2.id],
          },
          read: false,
          createdAt: new Date().toISOString(),
        };

        notificationStorage.addNotification(notification);
      }
    });
  };

  const getHangoutMatches = (): HangoutMatch[] => {
    if (!userId) return [];

    const notifications = notificationStorage.getNotifications();
    const hangoutNotifications = notifications.filter(
      (n) => n.userId === userId && n.type === "hangout_match",
    );

    return hangoutNotifications.map((notification) => ({
      id: notification.id,
      users: [userId, notification.data.matchedUserId],
      overlappingTime: notification.data.overlappingTime,
      hangoutEvents: notification.data.hangoutEvents,
      createdAt: notification.createdAt,
    }));
  };

  const getAllFriendHangouts = () => {
    if (!userId) return [];

    const currentUser = userStorage.getCurrentUser();
    if (!currentUser) return [];

    const allEvents = eventStorage.getEvents();
    const friends = userStorage
      .getUsers()
      .filter((user) => currentUser.friends.includes(user.id));

    const friendHangouts: Array<{ event: HangoutEvent; friend: User }> = [];

    friends.forEach((friend) => {
      const friendEvents = allEvents.filter(
        (event) => event.userId === friend.id && event.type === "hangout",
      ) as HangoutEvent[];

      friendEvents.forEach((event) => {
        friendHangouts.push({ event, friend });
      });
    });

    // Sort by start time
    friendHangouts.sort(
      (a, b) =>
        new Date(a.event.startTime).getTime() -
        new Date(b.event.startTime).getTime(),
    );

    return friendHangouts;
  };

  const getOverlappingHangouts = (targetDate: Date) => {
    if (!userId) return [];

    const currentUser = userStorage.getCurrentUser();
    if (!currentUser) return [];

    const allEvents = eventStorage.getEvents();
    const userHangouts = allEvents.filter(
      (event) => event.userId === userId && event.type === "hangout",
    ) as HangoutEvent[];

    const friends = userStorage
      .getUsers()
      .filter((user) => currentUser.friends.includes(user.id));

    const overlaps: Array<{
      userEvent: HangoutEvent;
      friendEvent: HangoutEvent;
      friend: User;
      overlap: { start: string; end: string };
    }> = [];

    userHangouts.forEach((userEvent) => {
      // Check if this event is on the target date
      const eventDate = new Date(userEvent.startTime);
      if (
        eventDate.getDate() === targetDate.getDate() &&
        eventDate.getMonth() === targetDate.getMonth() &&
        eventDate.getFullYear() === targetDate.getFullYear()
      ) {
        friends.forEach((friend) => {
          const friendHangouts = allEvents.filter(
            (event) => event.userId === friend.id && event.type === "hangout",
          ) as HangoutEvent[];

          friendHangouts.forEach((friendEvent) => {
            const overlap = getTimeOverlap(userEvent, friendEvent);
            if (overlap) {
              overlaps.push({
                userEvent,
                friendEvent,
                friend,
                overlap,
              });
            }
          });
        });
      }
    });

    return overlaps;
  };

  const checkEventOverlap = (eventId: string) => {
    if (!userId) return null;

    const currentUser = userStorage.getCurrentUser();
    if (!currentUser) return null;

    const allEvents = eventStorage.getEvents();
    const targetEvent = allEvents.find(
      (e) => e.id === eventId && e.type === "hangout",
    ) as HangoutEvent;

    if (!targetEvent || targetEvent.userId !== userId) return null;

    const friends = userStorage
      .getUsers()
      .filter((user) => currentUser.friends.includes(user.id));

    for (const friend of friends) {
      const friendHangouts = allEvents.filter(
        (event) => event.userId === friend.id && event.type === "hangout",
      ) as HangoutEvent[];

      for (const friendEvent of friendHangouts) {
        const overlap = getTimeOverlap(targetEvent, friendEvent);
        if (overlap) {
          return {
            userEvent: targetEvent,
            friendEvent,
            friend,
            overlap,
          };
        }
      }
    }

    return null;
  };

  return {
    events,
    isLoading,
    createEvent,
    updateEvent,
    deleteEvent,
    getFriendEvents,
    getFriendHangouts,
    getHangoutMatches,
    getAllFriendHangouts,
    getOverlappingHangouts,
    checkEventOverlap,
    loadEvents,
  };
};
