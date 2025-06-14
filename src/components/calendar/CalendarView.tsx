import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { HangoutOverlapModal } from "./HangoutOverlapModal";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  Clock,
  Users,
} from "lucide-react";
import { Event, HangoutEvent, User } from "@/types";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { cn } from "@/lib/utils";

interface CalendarViewProps {
  events: Event[];
  onDateSelect: (date: Date) => void;
  onEventClick: (event: Event) => void;
  getOverlappingHangouts?: (date: Date) => Array<{
    userEvent: HangoutEvent;
    friendEvent: HangoutEvent;
    friend: User;
    overlap: { start: string; end: string };
  }>;
  checkEventOverlap?: (eventId: string) => {
    userEvent: HangoutEvent;
    friendEvent: HangoutEvent;
    friend: User;
    overlap: { start: string; end: string };
  } | null;
  selectedDate?: Date;
}

export const CalendarView = ({
  events,
  onDateSelect,
  onEventClick,
  getOverlappingHangouts,
  checkEventOverlap,
  selectedDate,
}: CalendarViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showOverlapModal, setShowOverlapModal] = useState(false);
  const [selectedOverlap, setSelectedOverlap] = useState<{
    userEvent: HangoutEvent;
    friendEvent: HangoutEvent;
    friend: User;
    overlap: { start: string; end: string };
  } | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const getEventsForDay = (date: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.startTime);
      return isSameDay(eventDate, date);
    });
  };

  const getSelectedDateEvents = () => {
    if (!selectedDate) return [];
    return getEventsForDay(selectedDate);
  };

  const renderEventBadge = (event: Event) => {
    const hasOverlap =
      event.type === "hangout" &&
      checkEventOverlap &&
      checkEventOverlap(event.id);

    return (
      <div
        key={event.id}
        onClick={(e) => {
          e.stopPropagation();

          // If it's a hangout with overlap, show the overlap modal
          if (hasOverlap && event.type === "hangout") {
            setSelectedOverlap(hasOverlap);
            setShowOverlapModal(true);
          } else {
            onEventClick(event);
          }
        }}
        className={cn(
          "text-xs p-1 mb-1 rounded cursor-pointer hover:opacity-80 transition-all duration-200",
          event.type === "hangout" && hasOverlap
            ? "bg-gradient-to-r from-green-100 to-blue-100 text-green-800 border-2 border-green-300 shadow-md animate-pulse"
            : event.type === "hangout"
              ? "bg-blue-100 text-blue-800 border border-blue-200"
              : "bg-gray-100 text-gray-800 border border-gray-200",
        )}
      >
        <div className="flex items-center space-x-1">
          {event.type === "hangout" && hasOverlap ? (
            <Users className="h-3 w-3 text-green-600" />
          ) : event.type === "hangout" ? (
            <MapPin className="h-3 w-3" />
          ) : (
            <CalendarIcon className="h-3 w-3" />
          )}
          <span className="truncate">{event.title}</span>
          {hasOverlap && (
            <span className="text-green-600 font-semibold">!</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar Grid */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <CalendarIcon className="h-5 w-5" />
                <span>{format(currentMonth, "MMMM yyyy")}</span>
              </CardTitle>
              <div className="flex space-x-1">
                <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Calendar Header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="p-2 text-center text-sm font-medium text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((day) => {
                const dayEvents = getEventsForDay(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isCurrentDay = isToday(day);

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => onDateSelect(day)}
                    className={cn(
                      "min-h-[100px] p-2 border rounded-md cursor-pointer transition-colors",
                      isSelected && "bg-primary/10 border-primary",
                      isCurrentDay && "bg-blue-50 border-blue-200",
                      !isSelected &&
                        !isCurrentDay &&
                        "bg-background border-border hover:bg-muted",
                    )}
                  >
                    <div
                      className={cn(
                        "text-sm font-medium mb-1",
                        isCurrentDay && "text-blue-600",
                        isSelected && "text-primary",
                      )}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map(renderEventBadge)}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selected Date Events */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                {selectedDate
                  ? format(selectedDate, "MMM d, yyyy")
                  : "Select a date"}
              </span>
              {selectedDate && (
                <Button size="sm" onClick={() => onDateSelect(selectedDate)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Event
                </Button>
              )}
            </CardTitle>
            {selectedDate && (
              <CardDescription>
                {getSelectedDateEvents().length} event(s) scheduled
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {selectedDate ? (
              <div className="space-y-3">
                {getSelectedDateEvents().length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No events scheduled for this date
                  </p>
                ) : (
                  getSelectedDateEvents().map((event) => {
                    const hasOverlap =
                      event.type === "hangout" &&
                      checkEventOverlap &&
                      checkEventOverlap(event.id);

                    return (
                      <div
                        key={event.id}
                        onClick={() => {
                          if (hasOverlap && event.type === "hangout") {
                            setSelectedOverlap(hasOverlap);
                            setShowOverlapModal(true);
                          } else {
                            onEventClick(event);
                          }
                        }}
                        className={cn(
                          "p-3 border rounded-lg cursor-pointer transition-colors",
                          hasOverlap
                            ? "bg-gradient-to-r from-green-50 to-blue-50 border-green-200 hover:from-green-100 hover:to-blue-100"
                            : "hover:bg-muted",
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-medium">{event.title}</h4>
                              {event.type === "hangout" && (
                                <Badge variant="secondary" className="text-xs">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  Hangout
                                </Badge>
                              )}
                              {hasOverlap && (
                                <Badge
                                  variant="default"
                                  className="text-xs bg-green-600"
                                >
                                  <Users className="h-3 w-3 mr-1" />
                                  Match!
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>
                                {format(new Date(event.startTime), "h:mm a")} -{" "}
                                {format(new Date(event.endTime), "h:mm a")}
                              </span>
                            </div>
                            {event.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {event.description}
                              </p>
                            )}
                            {event.type === "hangout" &&
                              (event as HangoutEvent).preferences
                                ?.activitySuggestions && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {(
                                    event as HangoutEvent
                                  ).preferences.activitySuggestions
                                    .slice(0, 3)
                                    .map((activity, index) => (
                                      <Badge
                                        key={index}
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {activity}
                                      </Badge>
                                    ))}
                                  {(event as HangoutEvent).preferences
                                    .activitySuggestions.length > 3 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      +
                                      {(event as HangoutEvent).preferences
                                        .activitySuggestions.length - 3}{" "}
                                      more
                                    </Badge>
                                  )}
                                </div>
                              )}
                            {hasOverlap && (
                              <p className="text-sm text-green-600 font-medium mt-2">
                                🎉 Click to see friend overlap details!
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Click on a date to view events
              </p>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Event Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded"></div>
              <span className="text-sm">Personal Events</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded"></div>
              <span className="text-sm">Hangouts</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gradient-to-r from-green-100 to-blue-100 border-2 border-green-300 rounded"></div>
              <span className="text-sm">Overlapping Hangouts!</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hangout Overlap Modal */}
      <HangoutOverlapModal
        open={showOverlapModal}
        onOpenChange={setShowOverlapModal}
        userEvent={selectedOverlap?.userEvent || null}
        friendEvent={selectedOverlap?.friendEvent || null}
        friend={selectedOverlap?.friend || null}
        overlapTime={selectedOverlap?.overlap || null}
      />
    </div>
  );
};
