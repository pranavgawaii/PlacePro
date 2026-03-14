"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  Megaphone,
  MessageCircle,
  Plus,
  Search,
  Send,
  User2,
  Users,
  X
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Database } from "@/types/database.types";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type MessageInsert = Database["public"]["Tables"]["messages"]["Insert"];
type RecipientRow = Database["public"]["Tables"]["message_recipients"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"];

type MessageTab = "all" | "broadcasts" | "direct" | "help";
type MessageType = "broadcast" | "direct";

type Conversation = {
  key: string;
  isBroadcast: boolean;
  isHelp: boolean;
  title: string;
  subtitle: string;
  avatarUrl: string | null;
  lastMessage: MessageRow;
  messages: MessageRow[];
  seenCount: number;
  totalRecipients: number;
  unreadCount: number;
};

const BROADCAST_KEY = "broadcast";
const BROADCAST_TITLE = "TPO Announcements";
const BROADCAST_SUBTITLE = "Broadcast channel";
const BROADCAST_AVATAR = "/brand/mitadt.png";

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

function normalizeSubject(subject: string | null): string {
  return (subject ?? "").replace(/^\[HELP\]\s*/i, "").trim();
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
  const cleanSubject = normalizeSubject(message.subject);
  const prefix = cleanSubject ? `${cleanSubject}: ` : "";
  return `${prefix}${message.message}`;
}

function isHelpSubject(subject: string | null): boolean {
  return (subject ?? "").trim().toUpperCase().startsWith("[HELP]");
}

export function AdminMessagesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [adminUserId, setAdminUserId] = useState<string>("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);

  const [tab, setTab] = useState<MessageTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversationKey, setSelectedConversationKey] = useState<string | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [messageType, setMessageType] = useState<MessageType>("broadcast");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);

  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const [studentFilterQuery, setStudentFilterQuery] = useState("");

  const studentsByUserId = useMemo(() => {
    const map = new Map<string, StudentRow>();
    for (const student of students) {
      map.set(student.user_id, student);
    }
    return map;
  }, [students]);

  const recipientMap = useMemo(() => {
    const map = new Map<string, RecipientRow[]>();
    for (const row of recipients) {
      const current = map.get(row.message_id) ?? [];
      current.push(row);
      map.set(row.message_id, current);
    }
    return map;
  }, [recipients]);

  const fetchData = useCallback(async () => {
    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error(userError?.message ?? "Unable to verify admin session");
        return;
      }

      setAdminUserId(user.id);

      const [studentsRes, messagesRes] = await Promise.all([
        supabase.from("students").select("*").eq("is_active", true).order("name", { ascending: true }),
        supabase
          .from("messages")
          .select("*")
          .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
      ]);

      if (studentsRes.error || messagesRes.error) {
        toast.error(studentsRes.error?.message ?? messagesRes.error?.message ?? "Unable to load messages");
        return;
      }

      const nextMessages = messagesRes.data ?? [];
      const messageIds = nextMessages.map((row) => row.id);

      let nextRecipients: RecipientRow[] = [];
      if (messageIds.length > 0) {
        const recipientsRes = await supabase
          .from("message_recipients")
          .select("*")
          .in("message_id", messageIds);

        if (recipientsRes.error) {
          toast.error(recipientsRes.error.message);
          return;
        }
        nextRecipients = recipientsRes.data ?? [];
      }

      setStudents(studentsRes.data ?? []);
      setMessages(nextMessages);
      setRecipients(nextRecipients);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void fetchData();

    const channel = supabase
      .channel("admin-messages-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          void fetchData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_recipients" },
        () => {
          void fetchData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchData, supabase]);

  const selectedStudent = useMemo(() => {
    return students.find((student) => student.id === selectedStudentId) ?? null;
  }, [students, selectedStudentId]);

  const filteredStudents = useMemo(() => {
    const query = studentFilterQuery.trim().toLowerCase();
    if (!query) {
      return students;
    }

    return students.filter((student) => {
      return (
        student.name.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query) ||
        (student.prn ? student.prn.toLowerCase().includes(query) : false)
      );
    });
  }, [studentFilterQuery, students]);

  const conversations = useMemo<Conversation[]>(() => {
    const grouped = new Map<string, MessageRow[]>();

    for (const message of messages) {
      const key = message.is_broadcast
        ? BROADCAST_KEY
        : message.sender_id === adminUserId
          ? (message.recipient_id ?? `unknown-${message.id}`)
          : message.sender_id;
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
        const ownRecipientRow = (recipientMap.get(message.id) ?? []).find(
          (recipient) => recipient.recipient_id === adminUserId
        );
        return ownRecipientRow && !ownRecipientRow.read_at ? count + 1 : count;
      }, 0);

      if (isBroadcast) {
        const stats = recipientMap.get(lastMessage.id) ?? [];
        result.push({
          key,
          isBroadcast,
          isHelp: false,
          title: BROADCAST_TITLE,
          subtitle: BROADCAST_SUBTITLE,
          avatarUrl: BROADCAST_AVATAR,
          lastMessage,
          messages: sortedDesc,
          seenCount: stats.filter((row) => Boolean(row.read_at)).length,
          totalRecipients: stats.length,
          unreadCount
        });
        continue;
      }

      const student = studentsByUserId.get(key);
      const helpThread = sortedDesc.some(
        (message) => message.sender_id !== adminUserId && isHelpSubject(message.subject)
      );

      result.push({
        key,
        isBroadcast,
        isHelp: helpThread,
        title: student?.name ?? "Student",
        subtitle: helpThread
          ? "Support request from student"
          : student
            ? `${student.prn ?? "PRN pending"} • ${student.branch ?? "Branch pending"}`
            : "Direct message",
        avatarUrl: student?.avatar_url ?? null,
        lastMessage,
        messages: sortedDesc,
        seenCount: 0,
        totalRecipients: 0,
        unreadCount
      });
    }

    return result.sort(
      (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );
  }, [adminUserId, messages, recipientMap, studentsByUserId]);

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return conversations.filter((conversation) => {
      const matchesTab =
        tab === "all" ||
        (tab === "broadcasts"
          ? conversation.isBroadcast
          : tab === "help"
            ? conversation.isHelp
            : !conversation.isBroadcast && !conversation.isHelp);

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
    if (!selectedConversation || !adminUserId) {
      return [] as string[];
    }

    return selectedConversation.messages
      .flatMap((message) => recipientMap.get(message.id) ?? [])
      .filter((recipient) => recipient.recipient_id === adminUserId && !recipient.read_at)
      .map((recipient) => recipient.id);
  }, [adminUserId, recipientMap, selectedConversation]);

  useEffect(() => {
    if (!adminUserId || unreadReceiptIdsForSelected.length === 0) {
      return;
    }

    const markRead = async () => {
      const timestamp = new Date().toISOString();
      const { error } = await supabase
        .from("message_recipients")
        .update({ read_at: timestamp })
        .in("id", unreadReceiptIdsForSelected)
        .eq("recipient_id", adminUserId);

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
  }, [adminUserId, supabase, unreadReceiptIdsForSelected]);

  const resetComposer = useCallback(() => {
    setComposerOpen(false);
    setMessageType("broadcast");
    setSelectedStudentId("");
    setSubject("");
    setMessageBody("");
    setSending(false);
    setStudentPickerOpen(false);
    setStudentFilterQuery("");
  }, []);

  const handleSend = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!adminUserId) {
        toast.error("Admin session missing");
        return;
      }

      if (!messageBody.trim()) {
        toast.error("Message body is required");
        return;
      }

      if (messageType === "direct" && !selectedStudent) {
        toast.error("Select a student recipient");
        return;
      }

      setSending(true);

      const payload: MessageInsert = {
        sender_id: adminUserId,
        recipient_id: messageType === "direct" ? selectedStudent?.user_id ?? null : null,
        subject: subject.trim() ? subject.trim() : messageType === "broadcast" ? "Announcement" : null,
        message: messageBody.trim(),
        is_broadcast: messageType === "broadcast"
      };

      const { error } = await supabase.from("messages").insert(payload);

      if (error) {
        toast.error(error.message);
        setSending(false);
        return;
      }

      toast.success(
        messageType === "broadcast"
          ? `Broadcast sent to ${students.length} students`
          : `Message sent to ${selectedStudent?.name ?? "student"}`
      );

      setSelectedConversationKey(
        messageType === "broadcast" ? BROADCAST_KEY : (selectedStudent?.user_id ?? null)
      );

      resetComposer();
      await fetchData();
    },
    [
      adminUserId,
      fetchData,
      messageBody,
      messageType,
      resetComposer,
      selectedStudent,
      students.length,
      subject,
      supabase
    ]
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
      <div className="grid h-full grid-cols-1 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_16px_42px_-34px_rgba(15,23,42,0.45)] transition-shadow duration-300 lg:grid-cols-[360px_1fr]">
        <aside
          className={cn(
            "flex min-h-0 flex-col border-r border-neutral-200 bg-white",
            selectedConversation ? "hidden lg:flex" : "flex"
          )}
        >
          <div className="border-b border-neutral-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Admin Chat Desk</p>
                <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Messages</h1>
              </div>
              <Button
                type="button"
                size="icon"
                onClick={() => setComposerOpen(true)}
                className="h-9 w-9 rounded-xl border border-neutral-200 bg-white text-blue-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-sm"
                aria-label="Compose message"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search broadcasts or students"
                className="h-10 border-neutral-200 bg-white pl-9 text-neutral-900 placeholder:text-neutral-400 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-600"
                aria-label="Search messages"
              />
            </div>
          </div>

          <div className="border-b border-neutral-200 px-3 py-2">
            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as MessageTab)}
              className="w-full"
            >
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
            {filteredConversations.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center text-neutral-500">
                <MessageCircle className="mb-3 h-8 w-8 text-neutral-300" />
                <p className="text-sm font-medium">No conversations found</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {filteredConversations.map((conversation) => {
                  const isSelected = selectedConversationKey === conversation.key;
                  const lastMessageRecipients = recipientMap.get(conversation.lastMessage.id) ?? [];
                  const lastDirectMessageSeen = Boolean(
                    lastMessageRecipients.find((recipient) => recipient.recipient_id !== adminUserId)?.read_at
                  );
                  return (
                    <button
                      key={conversation.key}
                      type="button"
                      onClick={() => setSelectedConversationKey(conversation.key)}
                      className={cn(
                        "group relative w-full px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-inset",
                        isSelected ? "bg-neutral-50" : "hover:bg-neutral-50"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute inset-y-2 left-0 w-1 rounded-r-full bg-blue-600 transition-all duration-200",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                        aria-hidden="true"
                      />
                      <div className="flex items-start gap-3">
                        <Avatar className="mt-0.5 h-11 w-11 border border-neutral-200 transition-transform duration-200 group-hover:scale-[1.02]">
                          <AvatarImage src={conversation.avatarUrl ?? undefined} />
                          <AvatarFallback className="bg-black text-white">
                            {conversation.isBroadcast ? <Megaphone className="h-4 w-4" /> : getInitials(conversation.title)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold tracking-tight text-neutral-900">{conversation.title}</p>
                            <span className="shrink-0 text-xs text-neutral-500">
                              {safeFormatDate(conversation.lastMessage.created_at, "h:mm a")}
                            </span>
                          </div>

                          <p className="truncate text-xs text-neutral-500">{conversation.subtitle}</p>

                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className="line-clamp-1 text-xs text-neutral-600">
                              {getPreview(conversation.lastMessage)}
                            </p>
                            {conversation.isBroadcast ? (
                              <Badge variant="secondary" className="border border-neutral-200 bg-neutral-50 text-neutral-700">
                                {conversation.seenCount}/{conversation.totalRecipients} seen
                              </Badge>
                            ) : conversation.isHelp ? (
                              conversation.unreadCount > 0 ? (
                                <Badge variant="secondary" className="border border-blue-200 bg-blue-50 text-blue-700">
                                  {conversation.unreadCount} new
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="border border-neutral-200 bg-neutral-50 text-neutral-700">
                                  help
                                </Badge>
                              )
                            ) : (
                              <Badge variant="secondary" className="border border-neutral-200 bg-neutral-50 text-neutral-700">
                                {lastDirectMessageSeen ? "seen" : "not seen"}
                              </Badge>
                            )}
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
            selectedConversation ? "flex" : "hidden lg:flex"
          )}
        >
          {selectedConversation ? (
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
                    <p className="truncate text-sm font-semibold tracking-tight text-neutral-900">{selectedConversation.title}</p>
                    <p className="truncate text-xs text-neutral-500">{selectedConversation.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedConversation.isHelp ? (
                    <Badge variant="secondary" className="border border-blue-200 bg-blue-50 text-blue-700">
                      Help Inbox
                    </Badge>
                  ) : null}
                  <Button
                    type="button"
                    onClick={() => setComposerOpen(true)}
                    className="h-9 rounded-lg bg-blue-600 px-4 text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-sm"
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    New
                  </Button>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                  {threadMessages.map((message, index) => {
                    const previousMessage = threadMessages[index - 1];
                    const showDateLabel =
                      !previousMessage ||
                      safeFormatDate(previousMessage.created_at, "yyyy-MM-dd") !==
                      safeFormatDate(message.created_at, "yyyy-MM-dd");

                    const messageRecipients = recipientMap.get(message.id) ?? [];
                    const seenCount = messageRecipients.filter((recipient) => Boolean(recipient.read_at)).length;
                    const isOutgoing = message.sender_id === adminUserId;
                    const directRecipientRow = messageRecipients.find(
                      (recipient) => recipient.recipient_id !== adminUserId
                    );
                    const directSeen = Boolean(directRecipientRow?.read_at);
                    const recipientDetails = messageRecipients
                      .map((recipient) => {
                        const student = studentsByUserId.get(recipient.recipient_id);
                        return {
                          id: recipient.id,
                          name: student?.name ?? "Student",
                          prn: student?.prn ?? "PRN pending",
                          readAt: recipient.read_at
                        };
                      })
                      .sort((a, b) => {
                        const readWeight = Number(Boolean(b.readAt)) - Number(Boolean(a.readAt));
                        if (readWeight !== 0) return readWeight;
                        return a.name.localeCompare(b.name);
                      });

                    return (
                      <div key={message.id} className="space-y-2">
                        {showDateLabel ? (
                          <div className="flex justify-center">
                            <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600">
                              {safeFormatDate(message.created_at, "PPP")}
                            </span>
                          </div>
                        ) : null}

                        <div className={cn("flex", isOutgoing || message.is_broadcast ? "justify-end" : "justify-start")}>
                          <article
                            className={cn(
                              "max-w-[88%] rounded-2xl border px-4 py-3 shadow-sm transition-all duration-200",
                              message.is_broadcast
                                ? "rounded-br-md border border-blue-200 border-r-4 border-r-blue-600 bg-white text-neutral-900"
                                : isOutgoing
                                  ? "rounded-br-md border border-neutral-200 border-r-4 border-r-blue-500 bg-white text-neutral-900"
                                  : "rounded-bl-md border border-neutral-200 border-l-4 border-l-neutral-400 bg-neutral-50 text-neutral-900"
                            )}
                          >
                            {message.subject ? (
                              <p className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", message.is_broadcast ? "text-blue-700" : "text-neutral-600")}>
                                {normalizeSubject(message.subject)}
                              </p>
                            ) : null}

                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.message}</p>

                            <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px]">
                              <span className="text-neutral-500">
                                {safeFormatDate(message.created_at, "h:mm a")}
                              </span>
                              {message.is_broadcast ? (
                                <span className="inline-flex items-center gap-1 text-blue-600">
                                  <CheckCheck className="h-3.5 w-3.5 text-blue-600" />
                                  {seenCount}/{messageRecipients.length}
                                </span>
                              ) : !isOutgoing ? (
                                <Badge variant="secondary" className="border border-neutral-200 bg-white text-neutral-700">
                                  Received
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "border text-[10px] font-medium",
                                    directSeen
                                      ? "border-blue-200 bg-blue-50 text-blue-700"
                                      : "border-neutral-200 bg-neutral-50 text-neutral-600"
                                  )}
                                >
                                  {directSeen ? "Seen" : "Not seen"}
                                </Badge>
                              )}
                            </div>

                            {message.is_broadcast && recipientDetails.length > 0 ? (
                              <details className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50/80 p-2">
                                <summary className="cursor-pointer list-none text-[11px] font-semibold text-neutral-700">
                                  Seen by {seenCount}/{recipientDetails.length} students
                                </summary>
                                <div className="mt-2 max-h-32 space-y-1 overflow-y-auto pr-1">
                                  {recipientDetails.map((recipient) => (
                                    <div
                                      key={recipient.id}
                                      className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-2 py-1"
                                    >
                                      <div className="min-w-0">
                                        <p className="truncate text-[11px] font-medium text-neutral-800">{recipient.name}</p>
                                        <p className="truncate text-[10px] text-neutral-500">{recipient.prn}</p>
                                      </div>
                                      <Badge
                                        variant="secondary"
                                        className={cn(
                                          "border text-[10px] font-medium",
                                          recipient.readAt
                                            ? "border-blue-200 bg-blue-50 text-blue-700"
                                            : "border-neutral-200 bg-neutral-50 text-neutral-600"
                                        )}
                                      >
                                        {recipient.readAt ? `Seen ${safeFormatDate(recipient.readAt, "h:mm a", "seen")}` : "Not seen"}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            ) : null}

                            {!message.is_broadcast && isOutgoing ? (
                              <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[11px] text-neutral-700">
                                Recipient {directSeen ? `seen at ${safeFormatDate(directRecipientRow?.read_at, "h:mm a", "—")}` : "has not seen this message yet"}
                              </div>
                            ) : null}
                          </article>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <footer className="border-t border-neutral-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-neutral-500">
                    {selectedConversation.isHelp ? "Student support inbox" : "Official communication channel"}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      asChild
                      className="h-10 rounded-lg border-neutral-200 px-5 text-neutral-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-neutral-50 hover:shadow-sm"
                    >
                      <Link href="/admin/messages/reminders/new">Send Reminder</Link>
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setComposerOpen(true)}
                      className="h-10 rounded-lg bg-blue-600 px-5 text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-sm"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Compose
                    </Button>
                  </div>
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
                Choose a broadcast thread or direct student chat from the left panel.
              </p>
            </div>
          )}
        </main>
      </div>

      <Dialog open={composerOpen} onOpenChange={(open) => (open ? setComposerOpen(true) : resetComposer())}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-neutral-200 bg-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-neutral-900">New message</DialogTitle>
            <DialogDescription>
              Send a placement broadcast to everyone or message a student directly.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSend} className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <Label>Message Type</Label>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setMessageType("broadcast")}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                      messageType === "broadcast"
                        ? "bg-blue-600 text-white"
                        : "text-neutral-700 hover:bg-neutral-50"
                    )}
                  >
                    Broadcast
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageType("direct")}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                      messageType === "direct"
                        ? "bg-blue-600 text-white"
                        : "text-neutral-700 hover:bg-neutral-50"
                    )}
                  >
                    Direct
                  </button>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <Label>Recipient</Label>
                {messageType === "broadcast" ? (
                  <div className="flex h-10 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm text-blue-700">
                    <Users className="mr-2 h-4 w-4" />
                    All active students ({students.length})
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full justify-between border-neutral-300"
                    onClick={() => setStudentPickerOpen(true)}
                  >
                    {selectedStudent ? (
                      <span className="truncate">
                        {selectedStudent.name} ({selectedStudent.prn ?? "PRN pending"})
                      </span>
                    ) : (
                      <span className="text-neutral-500">Select student</span>
                    )}
                    <User2 className="h-4 w-4 text-neutral-500" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject (optional)</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="e.g. Aptitude test schedule"
                className="h-10 border-neutral-300 focus-visible:ring-2 focus-visible:ring-blue-600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                placeholder="Write your message..."
                className="min-h-40 border-neutral-300 focus-visible:ring-2 focus-visible:ring-blue-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-neutral-200 pt-4">
              <Button type="button" variant="ghost" onClick={resetComposer}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700" disabled={sending}>
                {sending ? "Sending..." : "Send message"}
                <Send className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={studentPickerOpen} onOpenChange={setStudentPickerOpen}>
        <DialogContent className="max-h-[80vh] overflow-hidden border-neutral-200 bg-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Select Student</DialogTitle>
            <DialogDescription>Choose a student to send a direct message.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={studentFilterQuery}
                onChange={(event) => setStudentFilterQuery(event.target.value)}
                placeholder="Search by name, email or PRN"
                className="pl-9"
              />
            </div>

            <div className="max-h-80 overflow-y-auto rounded-lg border border-neutral-200">
              {filteredStudents.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-neutral-500">No student found.</div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {filteredStudents.map((student) => {
                    const isSelected = student.id === selectedStudentId;
                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudentId(student.id);
                          setStudentPickerOpen(false);
                          setStudentFilterQuery("");
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-inset",
                          isSelected ? "bg-blue-50" : "hover:bg-neutral-50"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-neutral-900">{student.name}</p>
                          <p className="truncate text-xs text-neutral-500">
                            {student.prn ?? "PRN pending"} • {student.email}
                          </p>
                        </div>
                        {isSelected ? <CheckCheck className="h-4 w-4 text-blue-600" /> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            className="absolute right-4 top-4 h-8 w-8 p-0"
            onClick={() => setStudentPickerOpen(false)}
            aria-label="Close student selector"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
