"use client";

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

type MessageTab = "all" | "broadcasts" | "direct";
type MessageType = "broadcast" | "direct";

type Conversation = {
  key: string;
  isBroadcast: boolean;
  title: string;
  subtitle: string;
  avatarUrl: string | null;
  lastMessage: MessageRow;
  messages: MessageRow[];
  seenCount: number;
  totalRecipients: number;
};

const BROADCAST_KEY = "broadcast";
const BROADCAST_TITLE = "TPO Announcements";
const BROADCAST_SUBTITLE = "Broadcast channel";
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
  const prefix = message.subject?.trim() ? `${message.subject.trim()}: ` : "";
  return `${prefix}${message.message}`;
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
          .eq("sender_id", user.id)
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
      const key = message.is_broadcast ? BROADCAST_KEY : message.recipient_id ?? `unknown-${message.id}`;
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

      if (isBroadcast) {
        const stats = recipientMap.get(lastMessage.id) ?? [];
        result.push({
          key,
          isBroadcast,
          title: BROADCAST_TITLE,
          subtitle: BROADCAST_SUBTITLE,
          avatarUrl: BROADCAST_AVATAR,
          lastMessage,
          messages: sortedDesc,
          seenCount: stats.filter((row) => Boolean(row.read_at)).length,
          totalRecipients: stats.length
        });
        continue;
      }

      const student = studentsByUserId.get(key);

      result.push({
        key,
        isBroadcast,
        title: student?.name ?? "Student",
        subtitle: student
          ? `${student.prn ?? "PRN pending"} • ${student.branch ?? "Branch pending"}`
          : "Direct message",
        avatarUrl: student?.avatar_url ?? null,
        lastMessage,
        messages: sortedDesc,
        seenCount: 0,
        totalRecipients: 0
      });
    }

    return result.sort(
      (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );
  }, [messages, recipientMap, studentsByUserId]);

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
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">Admin Chat Desk</p>
                <h1 className="text-xl font-semibold">Messages</h1>
              </div>
              <Button
                type="button"
                size="icon"
                onClick={() => setComposerOpen(true)}
                className="h-9 w-9 rounded-xl bg-white text-blue-600 hover:bg-blue-50"
                aria-label="Compose message"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-200" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search broadcasts or students"
                className="h-10 border-white/20 bg-white/10 pl-9 text-white placeholder:text-blue-100 focus-visible:ring-white"
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
                <MessageCircle className="mb-3 h-8 w-8 text-neutral-300" />
                <p className="text-sm font-medium">No conversations found</p>
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
                            <p className="line-clamp-1 text-xs text-neutral-600">
                              {getPreview(conversation.lastMessage)}
                            </p>
                            {conversation.isBroadcast ? (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                {conversation.seenCount}/{conversation.totalRecipients} seen
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-neutral-100 text-neutral-700">
                                direct
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

                <Button
                  type="button"
                  onClick={() => setComposerOpen(true)}
                  className="h-9 rounded-lg bg-blue-600 px-4 text-white hover:bg-blue-700"
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  New
                </Button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                  {threadMessages.map((message, index) => {
                    const previousMessage = threadMessages[index - 1];
                    const showDateLabel =
                      !previousMessage ||
                      format(new Date(previousMessage.created_at), "yyyy-MM-dd") !==
                        format(new Date(message.created_at), "yyyy-MM-dd");

                    const messageRecipients = recipientMap.get(message.id) ?? [];
                    const seenCount = messageRecipients.filter((recipient) => Boolean(recipient.read_at)).length;

                    return (
                      <div key={message.id} className="space-y-2">
                        {showDateLabel ? (
                          <div className="flex justify-center">
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                              {format(new Date(message.created_at), "PPP")}
                            </span>
                          </div>
                        ) : null}

                        <div className="flex justify-end">
                          <article
                            className={cn(
                              "max-w-[88%] rounded-2xl border px-4 py-3 shadow-sm",
                              message.is_broadcast
                                ? "rounded-br-md border-blue-700 bg-blue-600 text-white"
                                : "rounded-br-md border-black bg-black text-white"
                            )}
                          >
                            {message.subject ? (
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-100">
                                {message.subject}
                              </p>
                            ) : null}

                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.message}</p>

                            <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px]">
                              <span className={message.is_broadcast ? "text-blue-100" : "text-neutral-300"}>
                                {format(new Date(message.created_at), "h:mm a")}
                              </span>
                              {message.is_broadcast ? (
                                <span className="inline-flex items-center gap-1 text-blue-100">
                                  <CheckCheck className="h-3.5 w-3.5" />
                                  {seenCount}/{messageRecipients.length}
                                </span>
                              ) : (
                                <CheckCheck className="h-3.5 w-3.5 text-neutral-300" />
                              )}
                            </div>
                          </article>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <footer className="border-t border-neutral-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-neutral-500">Official communication channel</p>
                  <Button
                    type="button"
                    onClick={() => setComposerOpen(true)}
                    className="h-10 rounded-lg bg-blue-600 px-5 text-white hover:bg-blue-700"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Compose
                  </Button>
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
              <div className="space-y-2">
                <Label>Message Type</Label>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
                  <button
                    type="button"
                    onClick={() => setMessageType("broadcast")}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm font-medium transition",
                      messageType === "broadcast"
                        ? "bg-blue-600 text-white"
                        : "text-neutral-700 hover:bg-white"
                    )}
                  >
                    Broadcast
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageType("direct")}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm font-medium transition",
                      messageType === "direct"
                        ? "bg-black text-white"
                        : "text-neutral-700 hover:bg-white"
                    )}
                  >
                    Direct
                  </button>
                </div>
              </div>

              <div className="space-y-2">
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
                    className="h-10 w-full justify-between"
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
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                placeholder="Write your message..."
                className="min-h-40"
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
                          "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition",
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
