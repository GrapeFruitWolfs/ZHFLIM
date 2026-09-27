import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectRecord } from "../shared/model";
import { api, errorMessage, ApiError } from "./api";

export type SaveState = "saved" | "pending" | "saving" | "error" | "conflict";

// The edit sequence and persistence sequence are deliberately separate. A response
// for an earlier edit must never replace input typed while that save was running.
export function useProject(initial: ProjectRecord) {
  const current = useRef(initial);
  const persisted = useRef(initial);
  const edits = useRef(0);
  const acknowledged = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const [project, setProject] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const flush = useCallback(async (): Promise<ProjectRecord> => {
    if (timer.current) clearTimeout(timer.current);
    while (inFlight.current) await inFlight.current;
    if (acknowledged.current === edits.current) return current.current;
    const run = async () => {
      while (acknowledged.current !== edits.current) {
        const sentSequence = edits.current;
        const sent = structuredClone(current.current);
        if (mounted.current) {
          setSaveState("saving");
          setSaveError("");
        }
        try {
          const saved = await api<ProjectRecord>(`/api/projects/${sent.id}`, {
            method: "PUT",
            body: JSON.stringify({
              project: sent,
              expectedRevision: persisted.current.draftRevision,
            }),
          });
          persisted.current = saved;
          acknowledged.current = sentSequence;
          current.current =
            edits.current === sentSequence
              ? saved
              : {
                  ...current.current,
                  draftRevision: saved.draftRevision,
                  updatedAt: saved.updatedAt,
                };
          if (mounted.current) setProject(current.current);
        } catch (error) {
          if (mounted.current) {
            setSaveState(
              error instanceof ApiError && error.status === 409
                ? "conflict"
                : "error",
            );
            setSaveError(errorMessage(error));
          }
          throw error;
        }
      }
      if (mounted.current) setSaveState("saved");
    };
    const promise = run();
    inFlight.current = promise;
    try {
      await promise;
    } finally {
      if (inFlight.current === promise) inFlight.current = null;
    }
    return current.current;
  }, []);

  const edit = useCallback(
    (mutate: (draft: ProjectRecord) => void) => {
      const next = structuredClone(current.current);
      mutate(next);
      edits.current += 1;
      current.current = next;
      setProject(next);
      setSaveState("pending");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flush().catch(() => undefined);
      }, 550);
    },
    [flush],
  );

  const replace = useCallback((next: ProjectRecord) => {
    if (timer.current) clearTimeout(timer.current);
    current.current = next;
    persisted.current = next;
    edits.current += 1;
    acknowledged.current = edits.current;
    setProject(next);
    setSaveState("saved");
    setSaveError("");
  }, []);

  useEffect(() => {
    const saveShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void flush().catch(() => undefined);
      }
    };
    const persistWhenHidden = () => {
      if (document.visibilityState === "hidden")
        void flush().catch(() => undefined);
    };
    window.addEventListener("keydown", saveShortcut);
    document.addEventListener("visibilitychange", persistWhenHidden);
    return () => {
      window.removeEventListener("keydown", saveShortcut);
      document.removeEventListener("visibilitychange", persistWhenHidden);
    };
  }, [flush]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (edits.current !== acknowledged.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  return { project, edit, flush, replace, saveState, saveError };
}
