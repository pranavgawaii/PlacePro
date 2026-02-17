"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  Inbox,
  Megaphone,
  MessageCircle,
  Search,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Database } from "@/types/database.types";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type RecipientRow = Database["public"]["Tables"]["message_recipients"]["Row"];

type MessageTab = "all" | "broadcasts" | "direct";

type Conversation = {
  key: string;
  isBroadcast: boolean;
  title: string;
  subtitle: string;
  avatarUrl: string | null;
  lastMessage: MessageRow;
  messages: MessageRow[];
  unreadCount: number;
};

const BROADCAST_KEY = "broadcast";
const BROADCAST_TITLE = "TPO Announcements";
const BROADCAST_SUBTITLE = "Official placement broadcasts";
const BROADCAST_AVATAR = "/mitadt.png";

function getInitials(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getPreview(message: MessageRow): string {
  let subject = message.subject?.trim() || "";
  // Strip redundant "From: Dr. Swati More" or similar prefixes
  if (subject.toLowerCase().startsWith("from:")) {
    subject = "";
  }
  const prefix = subject ? `${subject}: ` : "";
  return `${prefix}${message.message}`;
}

export function StudentMessagesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);

  const [tab, setTab] = useState<MessageTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversationKey, setSelectedConversationKey] = useState<string | null>(null);
  const [adminProfiles, setAdminProfiles] = useState<Record<string, { name: string; avatar_url: string | null }>>({});

  const receiptByMessage = useMemo(() => {
    const map = new Map<string, RecipientRow>();
    for (const row of recipients) {
      map.set(row.message_id, row);
    }
    return map;
  }, [recipients]);

  const fetchData = useCallback(
    async (userId: string) => {
      const [messagesRes, recipientsRes] = await Promise.all([
        supabase
          .from("messages")
          .select("*")
          .or(`is_broadcast.eq.true,recipient_id.eq.${userId}`)
          .order("created_at", { ascending: false }),
        supabase.from("message_recipients").select("*").eq("recipient_id", userId)
      ]);

      if (messagesRes.error || recipientsRes.error) {
        toast.error(messagesRes.error?.message ?? recipientsRes.error?.message ?? "Unable to load messages");
        return;
      }

      setMessages(messagesRes.data ?? []);
      setRecipients(recipientsRes.data ?? []);
    },
    [supabase]
  );

  useEffect(() => {
    let activeChannel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error(userError?.message ?? "Unable to verify session");
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);
      await fetchData(user.id);
      setLoading(false);

      activeChannel = supabase
        .channel(`student-messages-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages" },
          () => {
            void fetchData(user.id);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "message_recipients",
            filter: `recipient_id=eq.${user.id}`
          },
          () => {
            void fetchData(user.id);
          }
        )
        .subscribe();

      // Fetch Admin Profiles for Display
      fetch("/api/public/admins")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const profiles: Record<string, { name: string; avatar_url: string | null }> = {};
            data.forEach((admin: any) => {
              profiles[admin.id] = { name: admin.name, avatar_url: admin.avatar_url };
            });
            setAdminProfiles(profiles);
          }
        })
        .catch(err => console.error("Admin fetch error:", err));
    };

    void init();

    return () => {
      if (activeChannel) {
        void supabase.removeChannel(activeChannel);
      }
    };
  }, [fetchData, supabase]);

  const conversations = useMemo<Conversation[]>(() => {
    const grouped = new Map<string, MessageRow[]>();

    for (const message of messages) {
      const key = message.is_broadcast ? BROADCAST_KEY : message.sender_id;
      const current = grouped.get(key) ?? [];
      current.push(message);
      grouped.set(key, current);
    }

    const directConversations = [...grouped.keys()].filter((key) => key !== BROADCAST_KEY);
    const showSenderCode = directConversations.length > 1;

    const result: Conversation[] = [];

    for (const [key, messageRows] of grouped.entries()) {
      const sortedDesc = [...messageRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const lastMessage = sortedDesc[0];
      if (!lastMessage) {
        continue;
      }

      const isBroadcast = key === BROADCAST_KEY;

      const unreadCount = sortedDesc.reduce((count, message) => {
        const receipt = receiptByMessage.get(message.id);
        return receipt && !receipt.read_at ? count + 1 : count;
      }, 0);

      const admin = !isBroadcast ? adminProfiles[key] : null;

      const title = isBroadcast
        ? BROADCAST_TITLE
        : admin?.name || (showSenderCode ? `Office • ${key.slice(0, 6).toUpperCase()}` : "Placement Office");

      const avatarUrl = isBroadcast
        ? BROADCAST_AVATAR
        : admin?.avatar_url || (admin?.name ? `https://api.dicebear.com/7.x/initials/svg?seed=${admin.name}&backgroundColor=6366f1` : null);

      result.push({
        key,
        isBroadcast,
        title,
        subtitle: isBroadcast ? BROADCAST_SUBTITLE : "Direct Institutional Feed",
        avatarUrl,
        lastMessage,
        messages: sortedDesc,
        unreadCount
      });
    }

    return result.sort(
      (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );
  }, [messages, receiptByMessage]);

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return conversations.filter((conversation) => {
      const matchesTab =
        tab === "all" ||
        (tab === "broadcasts" ? conversation.isBroadcast : !conversation.isBroadcast);

      const matchesQuery =
        !query ||
        conversation.title.toLowerCase().includes(query) ||
        conversation.subtitle.toLowerCase().includes(query) ||
        getPreview(conversation.lastMessage).toLowerCase().includes(query);

      return matchesTab && matchesQuery;
    });
  }, [conversations, searchQuery, tab]);

  useEffect(() => {
    if (filteredConversations.length === 0) {
      setSelectedConversationKey(null);
      return;
    }

    if (
      !selectedConversationKey ||
      !filteredConversations.some((conversation) => conversation.key === selectedConversationKey)
    ) {
      setSelectedConversationKey(filteredConversations[0].key);
    }
  }, [filteredConversations, selectedConversationKey]);

  const selectedConversation = useMemo(() => {
    if (!selectedConversationKey) {
      return null;
    }
    return filteredConversations.find((conversation) => conversation.key === selectedConversationKey) ?? null;
  }, [filteredConversations, selectedConversationKey]);

  const threadMessages = useMemo(() => {
    if (!selectedConversation) {
      return [] as MessageRow[];
    }

    return [...selectedConversation.messages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [selectedConversation]);

  const unreadReceiptIdsForSelected = useMemo(() => {
    if (!selectedConversation) {
      return [] as string[];
    }

    return selectedConversation.messages
      .map((message) => receiptByMessage.get(message.id))
      .filter((row): row is RecipientRow => Boolean(row && !row.read_at))
      .map((row) => row.id);
  }, [receiptByMessage, selectedConversation]);

  useEffect(() => {
    if (!currentUserId || unreadReceiptIdsForSelected.length === 0) {
      return;
    }

    const markRead = async () => {
      const timestamp = new Date().toISOString();
      const { error } = await supabase
        .from("message_recipients")
        .update({ read_at: timestamp })
        .in("id", unreadReceiptIdsForSelected)
        .eq("recipient_id", currentUserId);

      if (error) {
        return;
      }

      setRecipients((previous) =>
        previous.map((row) =>
          unreadReceiptIdsForSelected.includes(row.id) ? { ...row, read_at: timestamp } : row
        )
      );
    };

    void markRead();
  }, [currentUserId, supabase, unreadReceiptIdsForSelected]);

  if (loading) {
    return (
      <section className="mx-auto h-[calc(100vh-92px)] w-full max-w-7xl p-4 font-sans">
        <div className="grid h-full grid-cols-1 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm lg:grid-cols-[360px_1fr]">
          <div className="space-y-4 border-r border-neutral-200 p-4">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-[560px] w-full" />
          </div>
          <div className="hidden p-4 lg:block">
            <Skeleton className="h-full w-full" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto h-[calc(100vh-92px)] w-full max-w-7xl p-4 font-sans">
      <div className="grid h-full grid-cols-1 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_20px_50px_-30px_rgba(37,99,235,0.45)] lg:grid-cols-[360px_1fr]">
        <aside
          className={cn(
            "flex min-h-0 flex-col border-r border-neutral-200 bg-white",
            selectedConversation ? "hidden lg:flex" : "flex"
          )}
        >
          <div className="border-b border-neutral-200 bg-gradient-to-r from-blue-600 to-blue-500 p-4 text-white">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">Student Inbox</p>
              <h1 className="text-xl font-semibold">Messages</h1>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-200" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search announcements"
                className="h-10 border-white/20 bg-white/10 pl-9 text-white placeholder:text-blue-100 focus-visible:ring-white"
                aria-label="Search messages"
              />
            </div>
          </div>

          <div className="border-b border-neutral-200 px-3 py-2">
            <Tabs value={tab} onValueChange={(value) => setTab(value as MessageTab)} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-neutral-100">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="broadcasts">Broadcasts</TabsTrigger>
                <TabsTrigger value="direct">Direct</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center text-neutral-500">
                <Inbox className="mb-3 h-8 w-8 text-neutral-300" />
                <p className="text-sm font-medium">No messages yet</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {filteredConversations.map((conversation) => {
                  const isSelected = selectedConversationKey === conversation.key;

                  return (
                    <button
                      key={conversation.key}
                      type="button"
                      onClick={() => setSelectedConversationKey(conversation.key)}
                      className={cn(
                        "w-full px-4 py-3 text-left transition",
                        isSelected ? "bg-blue-50" : "hover:bg-neutral-50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="mt-0.5 h-11 w-11 border border-neutral-200">
                          <AvatarImage src={conversation.avatarUrl ?? undefined} />
                          <AvatarFallback className="bg-black text-white">
                            {conversation.isBroadcast ? <Megaphone className="h-4 w-4" /> : getInitials(conversation.title)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-neutral-900">{conversation.title}</p>
                            <span className="shrink-0 text-xs text-neutral-500">
                              {format(new Date(conversation.lastMessage.created_at), "h:mm a")}
                            </span>
                          </div>

                          <p className="truncate text-xs text-neutral-500">{conversation.subtitle}</p>

                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className="line-clamp-1 text-xs text-neutral-600">{getPreview(conversation.lastMessage)}</p>
                            {conversation.unreadCount > 0 ? (
                              <Badge className="bg-blue-600 text-white hover:bg-blue-600">
                                {conversation.unreadCount}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <main
          className={cn(
            "min-h-0 flex-col bg-gradient-to-b from-white via-blue-50/30 to-white",
            selectedConversation ? "flex" : "hidden lg:flex"
          )}
        >
          {selectedConversation ? (
            <>
              <header className="flex items-center justify-between border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
                <div className="flex min-w-0 items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg lg:hidden"
                    onClick={() => setSelectedConversationKey(null)}
                    aria-label="Back to conversations"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <Avatar className="h-10 w-10 border border-neutral-200">
                    <AvatarImage src={selectedConversation.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-black text-white">
                      {selectedConversation.isBroadcast ? <Bell className="h-4 w-4" /> : getInitials(selectedConversation.title)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">{selectedConversation.title}</p>
                    <p className="truncate text-xs text-neutral-500">{selectedConversation.subtitle}</p>
                  </div>
                </div>

                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  Read only
                </Badge>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                  {threadMessages.map((message, index) => {
                    const previousMessage = threadMessages[index - 1];
                    const showDateLabel =
                      !previousMessage ||
                      format(new Date(previousMessage.created_at), "yyyy-MM-dd") !==
                      format(new Date(message.created_at), "yyyy-MM-dd");

                    return (
                      <div key={message.id} className="space-y-2">
                        {showDateLabel ? (
                          <div className="flex justify-center">
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                              {format(new Date(message.created_at), "PPP")}
                            </span>
                          </div>
                        ) : null}

                        <div className="flex justify-start">
                          <article
                            className={cn(
                              "max-w-[88%] rounded-2xl border px-4 py-3 shadow-sm",
                              message.is_broadcast
                                ? "rounded-tl-md border-blue-700 bg-blue-600 text-white"
                                : "rounded-tl-md border-neutral-200 bg-white text-neutral-900"
                            )}
                          >
                            {message.subject ? (
                              <p
                                className={cn(
                                  "mb-2 text-xs font-semibold uppercase tracking-wide",
                                  message.is_broadcast ? "text-blue-100" : "text-blue-700"
                                )}
                              >
                                {message.subject}
                              </p>
                            ) : null}

                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.message}</p>

                            <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px]">
                              <span className={message.is_broadcast ? "text-blue-100" : "text-neutral-500"}>
                                {format(new Date(message.created_at), "h:mm a")}
                              </span>
                              <CheckCheck className={message.is_broadcast ? "h-3.5 w-3.5 text-blue-100" : "h-3.5 w-3.5 text-blue-600"} />
                            </div>
                          </article>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <footer className="border-t border-neutral-200 bg-white px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  Replies are disabled. This channel is for official placement updates only.
                </div>
              </footer>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-100 p-4 text-blue-700">
                <MessageCircle className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-semibold text-neutral-900">Select a conversation</h2>
              <p className="mt-2 max-w-sm text-sm text-neutral-500">
                Open a broadcast or direct message to see your placement updates.
              </p>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
