"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  LifeBuoy,
  Mail,
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Database } from "@/types/database.types";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type RecipientRow = Database["public"]["Tables"]["message_recipients"]["Row"];

type MessageTab = "all" | "broadcasts" | "direct" | "help";

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
const BROADCAST_AVATAR = "/brand/mitadt.png";
const DIRECT_ADMIN_DEFAULT_NAME = "Dr. Swati More";
const DIRECT_ADMIN_DEFAULT_AVATAR = "/brand/mitadt.png";
const SUPPORT_GMAIL_COMPOSE_URL =
  "https://mail.google.com/mail/?view=cm&fs=1&to=admin@placepro.in&su=PlacePro%20Support%20Request";

type AdminProfile = { name: string; avatar_url: string | null };
type AdminProfileMap = Record<string, AdminProfile>;
type PublicAdminRow = { id: string; name?: string; avatar_url?: string | null };

function safeFormatDate(value: string | null | undefined, pattern: string, fallback = "—"): string {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  try {
    return format(parsed, pattern);
  } catch {
    return fallback;
  }
}

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
  let subject = (message.subject ?? "").replace(/^\[HELP\]\s*/i, "").trim();
  // Strip redundant "From: Dr. Swati More" or similar prefixes
  if (subject.toLowerCase().startsWith("from:")) {
    subject = "";
  }
  const prefix = subject ? `${subject}: ` : "";
  return `${prefix}${message.message}`;
}

function extractSenderNameFromSubject(subject: string | null): string | null {
  const normalized = subject?.trim() ?? "";
  if (!normalized.toLowerCase().startsWith("from:")) {
    return null;
  }

  const parsed = normalized.replace(/^from:\s*/i, "").trim();
  return parsed.length > 0 ? parsed : null;
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
  const [adminProfiles, setAdminProfiles] = useState<AdminProfileMap>({});
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSending, setSupportSending] = useState(false);

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
      fetch("/api/public/admins", { cache: "no-store" })
        .then((res) => {
          if (!res.ok) {
            return [] as PublicAdminRow[];
          }
          return res.json() as Promise<PublicAdminRow[]>;
        })
        .then(data => {
          if (Array.isArray(data)) {
            const profiles: AdminProfileMap = {};
            data.forEach((admin) => {
              const name = admin.name?.trim() || DIRECT_ADMIN_DEFAULT_NAME;
              profiles[admin.id] = { name, avatar_url: admin.avatar_url ?? null };
            });
            setAdminProfiles(profiles);
          }
        })
        .catch((err) => {
          if (err.name === 'AbortError' || err.message?.includes('aborted')) return;
          console.error("Failed to fetch admin profiles:", err);
        });
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
      const inferredName = !isBroadcast ? extractSenderNameFromSubject(lastMessage.subject) : null;

      const title = isBroadcast
        ? BROADCAST_TITLE
        : admin?.name || inferredName || DIRECT_ADMIN_DEFAULT_NAME;

      const avatarUrl = isBroadcast
        ? BROADCAST_AVATAR
        : admin?.avatar_url || DIRECT_ADMIN_DEFAULT_AVATAR;

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
  }, [messages, receiptByMessage, adminProfiles]);

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return conversations.filter((conversation) => {
      const matchesTab =
        tab === "all" ||
        (tab === "broadcasts"
          ? conversation.isBroadcast
          : tab === "help"
            ? false
            : !conversation.isBroadcast);

      const matchesQuery =
        !query ||
        conversation.title.toLowerCase().includes(query) ||
        conversation.subtitle.toLowerCase().includes(query) ||
        getPreview(conversation.lastMessage).toLowerCase().includes(query);

      return matchesTab && matchesQuery;
    });
  }, [conversations, searchQuery, tab]);

  useEffect(() => {
    if (tab === "help") {
      setSelectedConversationKey(null);
      return;
    }

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
  }, [filteredConversations, selectedConversationKey, tab]);

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

  const handleSupportSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmedSubject = supportSubject.trim();
      const trimmedMessage = supportMessage.trim();

      if (trimmedSubject.length < 3) {
        toast.error("Please add a clear subject");
        return;
      }

      if (trimmedMessage.length < 10) {
        toast.error("Please describe the issue in more detail");
        return;
      }

      setSupportSending(true);

      try {
        const response = await fetch("/api/student/support", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: trimmedSubject,
            message: trimmedMessage
          })
        });

        const payload = (await response.json().catch(() => ({}))) as { error?: string; success?: boolean };

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Unable to send support request");
        }

        toast.success("Your support request has been sent to the placement team");
        setSupportDialogOpen(false);
        setSupportSubject("");
        setSupportMessage("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to send support request";
        toast.error(message);
      } finally {
        setSupportSending(false);
      }
    },
    [supportMessage, supportSubject]
  );

  if (loading) {
    return (
      <section className="mx-auto min-h-[calc(100svh-92px)] w-full max-w-7xl py-4 px-0 sm:px-4 font-sans lg:h-[calc(100vh-92px)]">
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
    <section className="mx-auto min-h-[calc(100svh-92px)] w-full max-w-7xl py-4 px-0 sm:px-4 font-sans lg:h-[calc(100vh-92px)]">
      <div className="grid h-full grid-cols-1 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_16px_42px_-34px_rgba(15,23,42,0.45)] lg:grid-cols-[360px_1fr]">
        <aside
          className={cn(
            "flex min-h-0 flex-col border-r border-neutral-200 bg-white",
            tab === "help" ? "hidden lg:flex" : selectedConversation ? "hidden lg:flex" : "flex"
          )}
        >
          <div className="border-b border-neutral-200 bg-white p-4">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Student Inbox</p>
              <h1 className="text-xl font-semibold text-neutral-900">Messages</h1>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search announcements"
                className="h-10 border-neutral-200 bg-white pl-9 text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-blue-600"
                aria-label="Search messages"
              />
            </div>
          </div>

          <div className="border-b border-neutral-200 px-3 py-2">
            <Tabs value={tab} onValueChange={(value) => setTab(value as MessageTab)} className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 rounded-xl border border-neutral-200 bg-neutral-100/80 p-1">
                <TabsTrigger
                  value="all"
                  className="h-10 rounded-lg text-[13px] font-medium tracking-tight text-neutral-500 transition-all duration-200 data-[state=active]:text-neutral-900"
                >
                  All
                </TabsTrigger>
                <TabsTrigger
                  value="broadcasts"
                  className="h-10 rounded-lg text-[13px] font-medium tracking-tight text-neutral-500 transition-all duration-200 data-[state=active]:text-neutral-900"
                >
                  Broadcasts
                </TabsTrigger>
                <TabsTrigger
                  value="direct"
                  className="h-10 rounded-lg text-[13px] font-medium tracking-tight text-neutral-500 transition-all duration-200 data-[state=active]:text-neutral-900"
                >
                  Direct
                </TabsTrigger>
                <TabsTrigger
                  value="help"
                  className="h-10 rounded-lg text-[13px] font-medium tracking-tight text-neutral-500 transition-all duration-200 data-[state=active]:text-neutral-900"
                >
                  Help
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "help" ? (
              <div className="p-4">
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <p className="text-sm font-semibold tracking-tight text-neutral-900">Support Center</p>
                  <p className="mt-1 text-xs text-neutral-600">
                    Open the Help tab on the right to contact the placement team.
                  </p>
                </div>
              </div>
            ) : filteredConversations.length === 0 ? (
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
                        "relative w-full px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-inset",
                        isSelected ? "bg-neutral-50" : "hover:bg-neutral-50"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute inset-y-2 left-0 w-1 rounded-r-full bg-blue-600 transition-opacity",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                        aria-hidden="true"
                      />
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
                              {safeFormatDate(conversation.lastMessage.created_at, "h:mm a")}
                            </span>
                          </div>

                          <p className="truncate text-xs text-neutral-500">{conversation.subtitle}</p>

                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className="line-clamp-1 text-xs text-neutral-600">{getPreview(conversation.lastMessage)}</p>
                            {conversation.unreadCount > 0 ? (
                              <Badge className="bg-neutral-900 text-white hover:bg-neutral-900">
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
            "min-h-0 flex-col bg-white",
            selectedConversation || tab === "help" ? "flex" : "hidden lg:flex"
          )}
        >
          {tab === "help" ? (
            <div className="flex h-full items-center justify-center p-6">
              <div className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)]">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-2.5 text-blue-700">
                    <LifeBuoy className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Help & Support</h2>
                    <p className="text-sm text-neutral-600">
                      Reach the placement team for technical or process-related issues.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-sm font-semibold text-neutral-900">Contact Support Team</p>
                    <p className="mt-1 text-xs text-neutral-600">
                      Send a support request directly to admins from PlacePro.
                    </p>
                    <Button
                      type="button"
                      className="mt-3 h-10 w-full rounded-lg bg-blue-600 text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-sm"
                      onClick={() => setSupportDialogOpen(true)}
                    >
                      <LifeBuoy className="mr-2 h-4 w-4" />
                      Contact Support Team
                    </Button>
                  </div>

                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-sm font-semibold text-neutral-900">Email Placement Office</p>
                    <p className="mt-1 text-xs text-neutral-600">
                      Open Gmail compose with the placement office pre-filled.
                    </p>
                    <Button
                      asChild
                      variant="outline"
                      className="mt-3 h-10 w-full rounded-lg border-neutral-300 text-neutral-800 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
                    >
                      <a href={SUPPORT_GMAIL_COMPOSE_URL} target="_blank" rel="noopener noreferrer">
                        <Mail className="mr-2 h-4 w-4 text-blue-600" />
                        Open in Gmail
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedConversation ? (
            <>
              <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-neutral-600 hover:bg-neutral-100 lg:hidden"
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

                <Badge variant="secondary" className="border border-neutral-200 bg-neutral-50 text-neutral-700">
                  Read only
                </Badge>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                  {threadMessages.map((message, index) => {
                    const previousMessage = threadMessages[index - 1];
                    const showDateLabel =
                      !previousMessage ||
                      safeFormatDate(previousMessage.created_at, "yyyy-MM-dd") !==
                      safeFormatDate(message.created_at, "yyyy-MM-dd");

                    return (
                      <div key={message.id} className="space-y-2">
                        {showDateLabel ? (
                          <div className="flex justify-center">
                            <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600">
                              {safeFormatDate(message.created_at, "PPP")}
                            </span>
                          </div>
                        ) : null}

                        <div className="flex justify-start">
                          <article
                            className={cn(
                              "max-w-[88%] rounded-2xl border px-4 py-3 shadow-sm",
                              message.is_broadcast
                                ? "rounded-tl-md border border-blue-200 border-l-4 border-l-blue-600 bg-white text-neutral-900"
                                : "rounded-tl-md border-neutral-200 bg-white text-neutral-900"
                            )}
                          >
                            {(message.subject ?? "").replace(/^\[HELP\]\s*/i, "").trim() ? (
                              <p
                                className={cn(
                                  "mb-2 text-xs font-semibold uppercase tracking-wide",
                                  message.is_broadcast ? "text-blue-700" : "text-blue-700"
                                )}
                              >
                                {(message.subject ?? "").replace(/^\[HELP\]\s*/i, "").trim()}
                              </p>
                            ) : null}

                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.message}</p>

                            <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px]">
                              <span className="text-neutral-500">
                                {safeFormatDate(message.created_at, "h:mm a")}
                              </span>
                              <CheckCheck className="h-3.5 w-3.5 text-blue-600" />
                            </div>
                          </article>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <footer className="border-t border-neutral-200 bg-white px-4 py-3">
                <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  Replies are disabled. Use the Help tab for support requests.
                </div>
              </footer>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4 text-blue-700">
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

      <Dialog open={supportDialogOpen} onOpenChange={setSupportDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-neutral-200 bg-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-neutral-900">Contact Placement Support</DialogTitle>
            <DialogDescription>
              Share your issue with the placement team. Your request will appear in the admin help inbox.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSupportSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="support-subject">Subject</Label>
              <Input
                id="support-subject"
                value={supportSubject}
                onChange={(event) => setSupportSubject(event.target.value)}
                placeholder="Example: Unable to upload semester marksheet"
                className="h-10 border-neutral-300 focus-visible:ring-2 focus-visible:ring-blue-600"
                maxLength={120}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-message">Issue details</Label>
              <Textarea
                id="support-message"
                value={supportMessage}
                onChange={(event) => setSupportMessage(event.target.value)}
                placeholder="Please describe what happened and where you are stuck..."
                className="min-h-32 border-neutral-300 focus-visible:ring-2 focus-visible:ring-blue-600"
                maxLength={3000}
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-neutral-200 pt-4">
              <Button type="button" variant="ghost" onClick={() => setSupportDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700" disabled={supportSending}>
                {supportSending ? "Sending..." : "Send Support Request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
