"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MESSAGE_MAX, ROLE_LABEL, type ChatMessage, type ChatRole, type ConversationSummary } from "@/lib/messages/model";
import "@/styles/chat.css";

const THREAD_POLL = 8000;
const LIST_POLL = 30000;

const ERRORS: Record<string, string> = {
  EMPTY: "اكتب رسالة أولًا.",
  TOO_LONG: `الرسالة أطول من ${MESSAGE_MAX} حرف.`,
  READ_ONLY: "هذه المحادثة للاطلاع فقط.",
  NOT_FOUND: "لم تعد هذه المحادثة متاحة.",
  UNAUTHORIZED: "انتهت الجلسة، سجّل الدخول من جديد.",
};

const time = (iso: string) => new Intl.DateTimeFormat("ar-u-nu-latn", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
const dayKey = (iso: string) => iso.slice(0, 10);
function dayLabel(iso: string) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const key = dayKey(iso);
  if (key === today) return "اليوم";
  if (key === yesterday) return "أمس";
  return new Intl.DateTimeFormat("ar-u-ca-gregory-nu-latn", { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
}
function ago(iso?: string) {
  if (!iso) return "";
  const minutes = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `قبل ${minutes} د`;
  if (minutes < 1440) return `قبل ${Math.floor(minutes / 60)} س`;
  return dayLabel(iso);
}

function useVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/** One conversation: messages, polling while visible, and the composer. */
export function ChatThread({ as, id, title, subtitle, onRead, onBack, compact }: {
  as: ChatRole;
  id: string;
  title?: string;
  subtitle?: string;
  onRead?: () => void;
  onBack?: () => void;
  compact?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const visible = useVisible();
  // Callbacks from the parent change identity on render; keep them out of the effects.
  const onReadRef = useRef(onRead);
  useEffect(() => { onReadRef.current = onRead; }, [onRead]);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/messages/thread?id=${encodeURIComponent(id)}&as=${as}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(ERRORS[data.error] || "تعذّر تحميل المحادثة."); setMessages((current) => current || []); return; }
      setError("");
      setConversation(data.conversation);
      setMessages(data.messages);
      onReadRef.current?.();
    } catch {
      setError("تعذّر الاتصال. نحاول مجددًا…");
    }
  }, [as, id]);

  useEffect(() => { setMessages(null); setConversation(null); stick.current = true; void load(); }, [load]);
  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => void load(), THREAD_POLL);
    return () => clearInterval(timer);
  }, [load, visible]);
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/messages/thread?id=${encodeURIComponent(id)}&as=${as}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(ERRORS[data.error] || "لم تُرسل الرسالة، حاول مرة أخرى."); return; }
      stick.current = true;
      setText("");
      setMessages((current) => [...(current || []), data.message]);
    } catch {
      setError("لم تُرسل الرسالة. تحقق من الاتصال وحاول مرة أخرى.");
    } finally {
      setSending(false);
    }
  }

  const readOnly = conversation?.access === "read";
  const heading = title || conversation?.title || "المحادثة";
  const showNames = as === "admin" || conversation?.kind !== "st";

  return (
    <section className={`chat-thread${compact ? " is-compact" : ""}`} aria-label={`محادثة ${heading}`}>
      <header className="chat-thread-head">
        {onBack && <button type="button" className="chat-back" onClick={onBack} aria-label="العودة إلى المحادثات">→</button>}
        <span className="chat-avatar" aria-hidden="true">{heading.trim().slice(0, 1)}</span>
        <div>
          <b>{heading}</b>
          {(subtitle || conversation?.subtitle) && <small>{subtitle || conversation?.subtitle}</small>}
        </div>
      </header>
      <div
        className="chat-scroll"
        ref={scroller}
        onScroll={(event) => { const el = event.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }}
        role="log"
        aria-live="polite"
      >
        {messages === null ? <p className="chat-empty">جارٍ التحميل…</p>
          : !messages.length ? <p className="chat-empty">{readOnly ? "لا رسائل في هذه المحادثة بعد." : "لا رسائل بعد. اكتب أول رسالة."}</p>
            : messages.map((message, index) => {
              const mine = message.senderRole === as;
              const newDay = index === 0 || dayKey(messages[index - 1].createdAt) !== dayKey(message.createdAt);
              const sameSender = index > 0 && !newDay && messages[index - 1].senderRole === message.senderRole;
              return (
                <div key={message.id} className="chat-row-wrap">
                  {newDay && <div className="chat-day"><span>{dayLabel(message.createdAt)}</span></div>}
                  <div className={`chat-row ${mine && !readOnly ? "is-mine" : ""} ${sameSender ? "is-cont" : ""}`}>
                    <div className={`chat-bubble role-${message.senderRole}`}>
                      {!sameSender && (showNames || readOnly) && !(mine && !readOnly) && (
                        <span className="chat-sender">{message.senderRole === "admin" ? ROLE_LABEL.admin : message.senderName}</span>
                      )}
                      <p>{message.text}</p>
                      <time dateTime={message.createdAt}>{time(message.createdAt)}</time>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>
      {error && <p className="chat-error" role="alert">{error}</p>}
      {readOnly ? (
        <p className="chat-readonly">محادثة بين المشرف والمتدرب، معروضة للاطلاع.</p>
      ) : (
        <form className="chat-compose" onSubmit={send}>
          <label htmlFor={`chat-input-${id}`} className="chat-sr">رسالتك</label>
          <textarea
            id={`chat-input-${id}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}
            placeholder="اكتب رسالتك…"
            rows={1}
            maxLength={MESSAGE_MAX}
          />
          <button type="submit" disabled={sending || !text.trim()} aria-label="إرسال">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 3 3 10.5l7 2.5 2.5 7z" /><path d="m10 13 4-4" /></svg>
          </button>
        </form>
      )}
    </section>
  );
}

export type ChatPerson = { id: string; name: string; kind: "at" | "as"; detail?: string };

/** Conversation list plus the open thread; on phones one at a time. */
export function ChatInbox({ as, people, initialId, onUnread, emptyHint }: {
  as: ChatRole;
  /** Admin only: who a new conversation can be started with. */
  people?: ChatPerson[];
  initialId?: string | null;
  onUnread?: (count: number) => void;
  emptyHint?: string;
}) {
  const [list, setList] = useState<ConversationSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(initialId || null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "st">("all");
  const [starting, setStarting] = useState(false);
  const visible = useVisible();
  const onUnreadRef = useRef(onUnread);
  useEffect(() => { onUnreadRef.current = onUnread; }, [onUnread]);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/messages?as=${as}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setList(data.conversations);
    } catch { /* keep the last list */ }
  }, [as]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => void load(), LIST_POLL);
    return () => clearInterval(timer);
  }, [load, visible]);

  const choose = (id: string | null) => {
    setSelected(id);
    setStarting(false);
    try {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("chat", id); else url.searchParams.delete("chat");
      window.history.replaceState(null, "", url);
    } catch { /* ignore */ }
  };

  const markRead = useCallback(() => {
    setList((current) => {
      if (!current) return current;
      return current.map((item) => (item.id === selected ? { ...item, unread: 0 } : item));
    });
  }, [selected]);
  useEffect(() => { if (list) onUnreadRef.current?.(list.reduce((sum, item) => sum + item.unread, 0)); }, [list]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => (list || []).filter((item) =>
    (filter === "all" || (filter === "unread" ? item.unread > 0 : item.kind === "st"))
    && (!q || item.title.toLowerCase().includes(q))), [list, filter, q]);
  const active = (list || []).find((item) => item.id === selected);
  const startable = (people || []).filter((person) => !q || person.name.toLowerCase().includes(q));

  return (
    <div className={`chat-inbox ${selected || starting ? "has-thread" : ""}`}>
      <aside className="chat-list" aria-label="المحادثات">
        <div className="chat-list-head">
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث بالاسم" aria-label="بحث في المحادثات" />
          {as === "admin" && (
            <div className="chat-filters" role="group" aria-label="تصفية المحادثات">
              {([["all", "الكل"], ["unread", "غير مقروءة"], ["st", "مشرف ومتدرب"]] as const).map(([key, label]) => (
                <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>
              ))}
              {people && <button type="button" className="chat-new" onClick={() => { setSelected(null); setStarting(true); }}>+ محادثة جديدة</button>}
            </div>
          )}
        </div>
        {list === null ? <p className="chat-empty">جارٍ التحميل…</p>
          : !shown.length ? <p className="chat-empty">{q || filter !== "all" ? "لا نتائج." : emptyHint || "لا محادثات بعد."}</p>
            : (
              <ul>
                {shown.map((item) => (
                  <li key={item.id}>
                    <button type="button" className={item.id === selected ? "is-active" : ""} onClick={() => choose(item.id)} aria-current={item.id === selected ? "true" : undefined}>
                      <span className={`chat-avatar kind-${item.kind}`} aria-hidden="true">{item.title.trim().slice(0, 1)}</span>
                      <span className="chat-list-text">
                        <span className="chat-list-top"><b>{item.title}</b><small>{ago(item.lastMessage?.at)}</small></span>
                        <span className="chat-list-bottom">
                          <span>{item.lastMessage ? `${item.lastMessage.senderRole === as ? "أنت: " : ""}${item.lastMessage.text}` : item.subtitle}</span>
                          {item.unread > 0 && <em aria-label={`${item.unread} غير مقروءة`}>{item.unread}</em>}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
      </aside>
      <div className="chat-pane">
        {starting ? (
          <section className="chat-start" aria-label="بدء محادثة">
            <header className="chat-thread-head">
              <button type="button" className="chat-back" onClick={() => setStarting(false)} aria-label="العودة">→</button>
              <div><b>محادثة جديدة</b><small>اختر متدربًا أو مشرفًا</small></div>
            </header>
            <ul>
              {startable.map((person) => {
                const id = person.kind === "at" ? `at__${person.id}` : `as__${person.id}`;
                return (
                  <li key={id}>
                    <button type="button" onClick={() => choose(id)}>
                      <span className={`chat-avatar kind-${person.kind}`} aria-hidden="true">{person.name.trim().slice(0, 1)}</span>
                      <span className="chat-list-text"><b>{person.name}</b><small>{person.kind === "at" ? "متدرب" : "مشرف"}{person.detail ? ` · ${person.detail}` : ""}</small></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : selected ? (
          <ChatThread key={selected} as={as} id={selected} title={active?.title} subtitle={active?.subtitle} onRead={markRead} onBack={() => choose(null)} />
        ) : (
          <div className="chat-placeholder"><p>اختر محادثة من القائمة.</p></div>
        )}
      </div>
    </div>
  );
}

/** Polls the viewer's unread total, for a badge in the portal navigation. */
export function useUnreadMessages(as: ChatRole, enabled = true) {
  const [count, setCount] = useState(0);
  const visible = useVisible();
  useEffect(() => {
    if (!enabled || !visible) return;
    let stop = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/messages?as=${as}&count=1`, { cache: "no-store" });
        if (response.ok && !stop) setCount((await response.json()).unread || 0);
      } catch { /* keep the last count */ }
    };
    void load();
    const timer = setInterval(load, LIST_POLL);
    return () => { stop = true; clearInterval(timer); };
  }, [as, enabled, visible]);
  return [count, setCount] as const;
}
