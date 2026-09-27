import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, LoaderCircle, RefreshCw } from "lucide-react";
import { api, errorMessage } from "./api";

/** Each saved revision owns one request. A late response can never replace a newer preview. */
export function QuickPreview({ src, refreshKey }: { src: string; refreshKey: number }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const request = useRef(0);
  const pendingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [content, setContent] = useState<{ html: string; request: number } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [failure, setFailure] = useState("");
  const [retry, setRetry] = useState(0);
  const resize = useCallback(() => {
    const node = frame.current;
    const document = node?.contentDocument;
    const root = document?.querySelector<HTMLElement>(".render-root");
    if (node && document && root?.offsetWidth) {
      document.documentElement.style.zoom = String(node.clientWidth / root.offsetWidth);
      document.documentElement.style.overflowX = "hidden";
    }
  }, []);

  useEffect(() => {
    const sequence = ++request.current;
    const controller = new AbortController();
    let disposed = false;
    setState("loading");
    setFailure("");
    // Directory imports can acknowledge many revisions in quick succession.
    const debounce = setTimeout(() => {
      void (async () => {
        try {
          const html = await api<string>(src, { signal: controller.signal });
          if (disposed) return;
          if (typeof html !== "string" || !new DOMParser().parseFromString(html, "text/html").querySelector(".render-root"))
            throw new Error("预览内容不完整，请重试。");
          setContent({ html, request: sequence });
        } catch (error) {
          if (!disposed && !controller.signal.aborted) {
            clearTimeout(timeout);
            setFailure(errorMessage(error));
            setState("error");
          }
        }
      })();
    }, 220);
    const timeout = setTimeout(() => {
      if (disposed) return;
      controller.abort();
      setFailure("预览加载超时，请确认本机工作室仍在运行后重试。");
      setState("error");
    }, 30000);
    // onLoad clears the timeout as well as the fetch, so a stalled frame has a recovery path.
    pendingTimeout.current = timeout;
    return () => {
      disposed = true;
      clearTimeout(debounce);
      clearTimeout(timeout);
      controller.abort();
    };
  }, [src, refreshKey, retry]);

  useEffect(() => {
    if (!frame.current) return;
    const observer = new ResizeObserver(resize);
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, [resize, content]);

  return (
    <>
      {state !== "ready" && (
        <div className={`preview-loading ${state === "error" ? "preview-error" : ""}`} role={state === "error" ? "alert" : "status"}>
          {state === "error" ? <AlertCircle size={22} /> : <LoaderCircle size={20} className="spin" />}
          <span>{state === "error" ? "预览暂不可用" : "整理预览中"}</span>
          {state === "error" && (
            <>
              <p>{failure}</p>
              <button className="button button-outline button-small" onClick={() => setRetry(value => value + 1)}>
                <RefreshCw size={13} />重试预览
              </button>
            </>
          )}
        </div>
      )}
      {content && (
        <iframe
          key={content.request}
          ref={frame}
          title="交付文档手机预览"
          srcDoc={content.html}
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          onLoad={() => {
            if (content.request !== request.current) return;
            if (pendingTimeout.current) clearTimeout(pendingTimeout.current);
            resize();
            setState("ready");
          }}
        />
      )}
    </>
  );
}
