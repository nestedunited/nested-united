"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export function NotificationManager() {
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevUnreadCountRef = useRef(0);

  const playWebAudioNotification = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // Higher pitch for notification
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error("Error with Web Audio API:", error);
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      // Try to play audio file first
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {
          // Fallback to Web Audio API
          playWebAudioNotification();
        });
      } else {
        // Fallback to Web Audio API
        playWebAudioNotification();
      }
    } catch (error) {
      console.error("Error with audio:", error);
      // Fallback to Web Audio API
      playWebAudioNotification();
    }
  }, [playWebAudioNotification]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // Load initial unread count
    const loadUnreadCount = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;

        // Get user role
        const { data: user } = await supabase
          .from("users")
          .select("role")
          .eq("id", authUser.id)
          .single();

        if (!user) return;

        // Build query based on user role
        let query = supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("is_read", false);

        // Filter by audience or recipient
        const orConditions = [`recipient_user_id.eq.${authUser.id}`, "audience.eq.all_users"];
        
        if (user.role === "admin" || user.role === "super_admin") {
          orConditions.push("audience.eq.all_admins");
        }
        if (user.role === "super_admin") {
          orConditions.push("audience.eq.all_super_admins");
        }
        if (user.role === "maintenance_worker") {
          orConditions.push("audience.eq.maintenance_workers");
        }

        query = query.or(orConditions.join(","));

        const { count } = await query;
        const newCount = count || 0;
        
        setUnreadCount(newCount);
        prevUnreadCountRef.current = newCount;
      } catch (error) {
        console.error("Error loading unread count:", error);
      }
    };

    loadUnreadCount();

    // Subscribe to notifications changes
    console.log("[NotificationManager] Setting up Realtime subscription...");
    
    // Fallback: Polling every 5 seconds if Realtime doesn't work (especially in Electron)
    let lastCount = 0;
    const pollingInterval = setInterval(async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;

        const { data: user } = await supabase
          .from("users")
          .select("role")
          .eq("id", authUser.id)
          .single();

        if (!user) return;

        const orConditions = [`recipient_user_id.eq.${authUser.id}`, "audience.eq.all_users"];
        if (user.role === "admin" || user.role === "super_admin") {
          orConditions.push("audience.eq.all_admins");
        }
        if (user.role === "super_admin") {
          orConditions.push("audience.eq.all_super_admins");
        }
        if (user.role === "maintenance_worker") {
          orConditions.push("audience.eq.maintenance_workers");
        }

        const { count, data } = await supabase
          .from("notifications")
          .select("*", { count: "exact" })
          .eq("is_read", false)
          .or(orConditions.join(","))
          .order("created_at", { ascending: false })
          .limit(1);

        const currentCount = count || 0;
        if (currentCount > lastCount && data && data.length > 0) {
          // New notification detected via polling
          const notification = data[0];
          console.log("[NotificationManager] New notification detected via polling:", notification);
          
          playNotificationSound();
          
          if (typeof window !== "undefined" && window.electronAPI?.isElectron) {
            if (window.electronAPI?.sendDatabaseNotification) {
              window.electronAPI.sendDatabaseNotification({
                title: notification.title || "إشعار جديد",
                body: notification.body || "لديك إشعار جديد",
                id: notification.id,
              });
            }
          } else if ("Notification" in window && Notification.permission === "granted") {
            new Notification(notification.title || "إشعار جديد", {
              body: notification.body || "لديك إشعار جديد",
              icon: "/icon.png",
              badge: "/icon.png",
              tag: notification.id,
              requireInteraction: false,
            });
          }
        }
        lastCount = currentCount;
        setUnreadCount(currentCount);
      } catch (error) {
        console.error("[NotificationManager] Polling error:", error);
      }
    }, 5000); // Poll every 5 seconds

    channel = supabase
      .channel("notifications-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        async (payload) => {
          console.log("[NotificationManager] Notification change detected:", payload);
          
          // Reload unread count
          await loadUnreadCount();
          
          // If new notification was inserted, play sound and show notification
          if (payload.eventType === "INSERT") {
            const notification = payload.new as any;
            
            // Check if this notification is for the current user
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) return;

            // Get user role
            const { data: user } = await supabase
              .from("users")
              .select("role")
              .eq("id", authUser.id)
              .single();

            if (!user) return;

            // Check if notification is for this user
            const isForUser =
              notification.recipient_user_id === authUser.id ||
              notification.audience === "all_users" ||
              (notification.audience === "all_admins" && (user.role === "admin" || user.role === "super_admin")) ||
              (notification.audience === "all_super_admins" && user.role === "super_admin") ||
              (notification.audience === "maintenance_workers" && user.role === "maintenance_worker");

            if (isForUser && !notification.is_read) {
              // Play notification sound
              playNotificationSound();
              
              // Show system notification
              // Check if running in Electron first
              if (typeof window !== "undefined" && window.electronAPI?.isElectron) {
                // Use Electron's notification system
                // Send notification to Electron main process via IPC
                console.log("[NotificationManager] Sending database notification to Electron:", notification);
                if (window.electronAPI?.sendDatabaseNotification) {
                  window.electronAPI.sendDatabaseNotification({
                    title: notification.title || "إشعار جديد",
                    body: notification.body || "لديك إشعار جديد",
                    id: notification.id,
                  });
                }
              } else if ("Notification" in window) {
                // Web browser notification
                if (Notification.permission === "granted") {
                  new Notification(notification.title || "إشعار جديد", {
                    body: notification.body || "لديك إشعار جديد",
                    icon: "/icon.png",
                    badge: "/icon.png",
                    tag: notification.id,
                    requireInteraction: false,
                  });
                } else if (Notification.permission === "default") {
                  Notification.requestPermission().then((permission) => {
                    if (permission === "granted") {
                      new Notification(notification.title || "إشعار جديد", {
                        body: notification.body || "لديك إشعار جديد",
                        icon: "/icon.png",
                        badge: "/icon.png",
                        tag: notification.id,
                        requireInteraction: false,
                      });
                    }
                  });
                }
              }
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("[NotificationManager] Realtime subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log("[NotificationManager] ✅ Successfully subscribed to notifications");
        } else if (status === "CHANNEL_ERROR") {
          console.error("[NotificationManager] ❌ Channel error - Realtime may not work in Electron");
        }
      });

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Create audio element for notification sound
    // Try to load notification sound, fallback to Web Audio API
    try {
      audioRef.current = new Audio("/notification.mp3");
      audioRef.current.volume = 0.5;
    } catch (error) {
      console.log("Could not load notification sound file, will use Web Audio API");
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [playNotificationSound]);

  // Store unread count in a way that Header can access it
  useEffect(() => {
    // Dispatch custom event with unread count
    window.dispatchEvent(
      new CustomEvent("unread-count-updated", { detail: { count: unreadCount } })
    );
  }, [unreadCount]);

  return null; // This component doesn't render anything
}

