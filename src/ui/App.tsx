import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  useId,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  ImagePlus,
  Layers,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  X,
  AlertCircle,
  CheckCircle2,
  Circle,
  SlidersHorizontal,
  Undo2,
  Archive,
  Link,
  PanelRightClose,
  PanelRightOpen,
  GripVertical,
  ArrowLeftRight,
  Scissors,
  ExternalLink,
  Film,
  Image as ImageIcon,
} from "lucide-react";
import type {
  Asset,
  AssetRef,
  Comparison,
  ComparisonBlock,
  DeliveryItem,
  DocumentBlock,
  ExportRecord,
  ImportReport,
  OutputTarget,
  Preset,
  PreviewCandidate,
  ProjectRecord,
  ProjectSummary,
  RecognitionRule,
  StudioSettings,
  VisibleText,
} from "../shared/model";
import { newId } from "../shared/model";
import { TEMPLATES, getTemplate, type TemplateId } from "../shared/templates";
import {
  CONTENT_LIBRARY,
  createComparison,
  createDeliveryItem,
  createTextBlock,
  createCover,
  createProductionDetails,
} from "../shared/defaults";
import { api, ApiError, errorMessage, post, setSessionToken } from "./api";
import {
  bytes,
  fromDrop,
  fromInput,
  isDocumentImage,
  observations,
  type FileSelection,
  type SelectedFile,
} from "./importFiles";
import { useProject, type SaveState } from "./useProject";
import { QuickPreview } from "./QuickPreview";

type Navigation = "projects" | "settings" | "project";
type WorkTab = "content" | "assets" | "visual";
type Toast = { message: string; error?: boolean };
const labels = { pdf: "PDF 文档", image: "长图", both: "PDF + 长图" };
const dateLabel = (value: string) =>
  value
    ? new Date(value).toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
      })
    : "尚未填写";
const sorted = <T extends { order: number }>(items: T[]) =>
  [...items].sort((a, b) => a.order - b.order);
function reorder<T extends { order: number }>(
  items: T[],
  index: number,
  direction: number,
) {
  const list = sorted(items);
  const next = index + direction;
  if (next < 0 || next >= list.length) return items;
  [list[index], list[next]] = [list[next], list[index]];
  list.forEach((item, position) => {
    item.order = position;
  });
  return list;
}

function IconButton({
  label,
  children,
  ...props
}: {
  label: string;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="icon-button"
      title={label}
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  );
}
function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    if (!dialog.current?.contains(document.activeElement))
      dialog.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key === "Tab" && dialog.current) {
        const nodes = [
          ...dialog.current.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex]:not([tabindex='-1'])",
          ),
        ].filter((node) => node.tabIndex >= 0 && node.getClientRects().length > 0);
        const first = nodes[0];
        const last = nodes.at(-1);
        if (!first) {
          event.preventDefault();
          dialog.current.focus();
        } else if (document.activeElement === dialog.current || !dialog.current.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={dialog}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">DELIVERY STUDIO</p>
            <h2>{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <IconButton label="关闭" onClick={onClose}>
            <X size={19} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const labelId = useId();
  const control = isValidElement<{ "aria-labelledby"?: string; "aria-describedby"?: string }>(children)
    ? cloneElement(children, { "aria-labelledby": labelId, ...(hint ? { "aria-describedby": `${labelId}-hint` } : {}) })
    : children;
  return (
    <label className="field">
      <span className="field-label" id={labelId}>{label}</span>
      {control}
      {hint && <span className="field-hint" id={`${labelId}-hint`}>{hint}</span>}
    </label>
  );
}
function VisibleField({
  label,
  field,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  field: VisibleText;
  onChange: (value: VisibleText) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className={`visible-field ${field.visible ? "" : "field-hidden"}`}>
      <Field label={label}>
        <input
          type={type}
          value={field.value}
          placeholder={placeholder}
          onChange={(event) =>
            onChange({ ...field, value: event.target.value })
          }
        />
      </Field>
      <IconButton
        label={field.visible ? `隐藏${label}` : `显示${label}`}
        aria-pressed={field.visible}
        onClick={() => onChange({ ...field, visible: !field.visible })}
      >
        {field.visible ? <Eye size={17} /> : <EyeOff size={17} />}
      </IconButton>
    </div>
  );
}
function CheckRow({
  checked,
  onChange,
  children,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="check-row">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        {children}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [initialError, setInitialError] = useState("");
  const [navigation, setNavigation] = useState<Navigation>("projects");
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [opening, setOpening] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const leaveGuard = useRef<null | (() => Promise<unknown>)>(null);
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.error ? 9000 : 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const refresh = useCallback(async () => {
    const [allProjects, allPresets] = await Promise.all([
      api<ProjectSummary[]>("/api/projects"),
      api<Preset[]>("/api/presets"),
    ]);
    setProjects(allProjects);
    setPresets(allPresets);
  }, []);
  const openProject = async (id: string) => {
    try {
      await leaveGuard.current?.();
      setOpening(true);
      const record = await api<ProjectRecord>(`/api/projects/${id}`);
      setProject(record);
      setNavigation("project");
      window.history.replaceState(null, "", `#project/${id}`);
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setOpening(false);
    }
  };
  const navigate = async (view: "projects" | "settings") => {
    try {
      await leaveGuard.current?.();
      setNavigation(view);
      setProject(null);
      window.history.replaceState(null, "", `#${view}`);
      await refresh();
    } catch (error) {
      notify(`先恢复保存后再离开：${errorMessage(error)}`, true);
    }
  };
  useEffect(() => {
    void (async () => {
      try {
        const session = await api<{ token: string; settings: StudioSettings }>(
          "/api/session",
        );
        setSessionToken(session.token);
        setSettings(session.settings);
        await refresh();
        setReady(true);
        const initialId = window.location.hash.match(/^#project\/(.+)$/)?.[1];
        if (initialId) {
          const record = await api<ProjectRecord>(
            `/api/projects/${encodeURIComponent(initialId)}`,
          );
          setProject(record);
          setNavigation("project");
        } else if (window.location.hash === "#settings")
          setNavigation("settings");
      } catch (error) {
        setInitialError(errorMessage(error));
      }
    })();
  }, [refresh]);

  if (!ready)
    return (
      <div className="boot-screen">
        <div className="brand-mark">
          d<span>.</span>
        </div>
        <h1>Delivery Studio</h1>
        {initialError ? (
          <>
            <p>{initialError}</p>
            <button className="button" onClick={() => window.location.reload()}>
              重新连接
            </button>
          </>
        ) : (
          <p>
            <LoaderCircle size={16} className="spin" /> 正在连接本机工作室
          </p>
        )}
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => void navigate("projects")}
          aria-label="Delivery Studio 项目首页"
        >
          <span className="brand-mark">
            d<span>.</span>
          </span>
          <span>
            DELIVERY
            <br />
            <b>STUDIO</b>
          </span>
        </button>
        <div className="sidebar-group">
          <p className="nav-caption">工作空间</p>
          <button
            className={`nav-item ${navigation !== "settings" ? "active" : ""}`}
            onClick={() => void navigate("projects")}
          >
            <Layers size={18} />
            项目
            <span className="nav-count">
              {projects.filter((item) => !item.archived).length}
            </span>
          </button>
          <button
            className={`nav-item ${navigation === "settings" ? "active" : ""}`}
            onClick={() => void navigate("settings")}
          >
            <Settings2 size={18} />
            工作室设置
          </button>
        </div>
        <div className="sidebar-bottom">
          <span className="connection">
            <i />
            本机工作室
          </span>
          <p>留给作品的最后一份用心。</p>
          <div className="studio-avatar">
            {(settings?.studioName || "S").slice(0, 1)}
            <span>
              {settings?.studioName || "我的工作室"}
              <small>LOCAL WORKSPACE</small>
            </span>
          </div>
        </div>
      </aside>
      <main
        className={`app-main ${navigation === "project" ? "work-main" : ""}`}
      >
        {opening && (
          <div className="opening-overlay">
            <LoaderCircle className="spin" />
            正在打开项目
          </div>
        )}
        {navigation === "projects" && (
          <ProjectList
            projects={projects}
            presets={presets}
            onOpen={openProject}
            refresh={refresh}
            notify={notify}
          />
        )}
        {navigation === "settings" && settings && (
          <SettingsPage
            settings={settings}
            onSaved={setSettings}
            notify={notify}
            presets={presets}
          />
        )}
        {navigation === "project" && project && (
          <Workbench
            key={project.id}
            initial={project}
            presets={presets}
            notify={notify}
            refresh={refresh}
            leaveGuard={leaveGuard}
            onBack={() => void navigate("projects")}
          />
        )}
      </main>
      {toast && (
        <div
          className={`toast ${toast.error ? "toast-error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
          <IconButton label="关闭通知" onClick={() => setToast(null)}>
            <X size={16} />
          </IconButton>
        </div>
      )}
    </div>
  );
}

function ProjectList({
  projects,
  presets,
  onOpen,
  refresh,
  notify,
}: {
  projects: ProjectSummary[];
  presets: Preset[];
  onOpen: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  notify: (message: string, error?: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [presetId, setPresetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState("");
  const filtered = projects.filter(
    (item) =>
      item.archived === archived &&
      `${item.title} ${item.projectNo} ${item.coupleNames}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const record = await post<ProjectRecord>("/api/projects", {
        title: title.trim(),
        presetId: presetId || presets[0]?.id,
      });
      setCreating(false);
      setTitle("");
      await refresh();
      await onOpen(record.id);
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  const archive = async (summary: ProjectSummary) => {
    setActing(summary.id);
    try {
      const record = await api<ProjectRecord>(`/api/projects/${summary.id}`);
      await api(`/api/projects/${summary.id}`, {
        method: "PUT",
        body: JSON.stringify({
          project: { ...record, archived: !record.archived },
          expectedRevision: record.draftRevision,
        }),
      });
      await refresh();
      notify(summary.archived ? "项目已恢复" : "项目已归档，资料仍然保留");
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setActing("");
    }
  };
  const duplicate = async (summary: ProjectSummary) => {
    if (
      !window.confirm(
        "复制内容结构与视觉作为另一场婚礼。原客户、日期、客户链接和项目图片将清空。继续复制？",
      )
    )
      return;
    setActing(summary.id);
    try {
      const record = await post<ProjectRecord>(
        `/api/projects/${summary.id}/duplicate`,
      );
      await refresh();
      await onOpen(record.id);
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setActing("");
    }
  };
  return (
    <div className="page projects-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            <span className="tiny-line" /> WEDDING DELIVERY STUDIO
          </p>
          <h1>
            作品落幕，故事启程<span className="accent-dot">.</span>
          </h1>
          <p className="page-intro">整理这次交付，让每一份用心都被看见。</p>
        </div>
        <button className="button" onClick={() => setCreating(true)}>
          <Plus size={17} />
          创建项目
        </button>
      </header>
      <section className="studio-note">
        <span className="note-number">01 / THE FINAL CHAPTER</span>
        <div>
          <h2>从拍摄完成，到妥善交付。</h2>
          <p>内容、调色对比与视觉，在一个安静的工作台里完成。</p>
        </div>
        <span className="note-flower" aria-hidden="true">
          ✳
        </span>
      </section>
      <div className="collection-heading">
        <div className="collection-tabs">
          <button
            className={!archived ? "selected" : ""}
            onClick={() => setArchived(false)}
          >
            我的项目{" "}
            <span>{projects.filter((item) => !item.archived).length}</span>
          </button>
          <button
            className={archived ? "selected" : ""}
            onClick={() => setArchived(true)}
          >
            已归档{" "}
            <span>{projects.filter((item) => item.archived).length}</span>
          </button>
        </div>
        <label className="search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索姓名或项目编号"
            aria-label="搜索项目"
          />
          {search && (
            <IconButton label="清空搜索" onClick={() => setSearch("")}>
              <X size={14} />
            </IconButton>
          )}
        </label>
      </div>
      {!filtered.length ? (
        <div className="projects-empty">
          <div className="empty-editorial">
            <p className="eyebrow">A PLACE FOR YOUR STORIES</p>
            <h2>
              {search
                ? "还没有找到这份故事。"
                : archived
                  ? "这里保存已完成的故事。"
                  : "第一份交付，\n从这里开始。"}
            </h2>
            <p>
              {search
                ? "试试另一个姓名，或项目编号。"
                : archived
                  ? "归档后的项目仍可重新打开、编辑与导出。"
                  : "选择交付内容，导入项目资料。\n剩下的整理与排版，交给工作台。"}
            </p>
            {!search && !archived && (
              <button
                className="button button-outline"
                onClick={() => setCreating(true)}
              >
                创建第一份项目
                <ArrowUpRight size={17} />
              </button>
            )}
          </div>
          <div className="paper-illustration" aria-hidden="true">
            <div className="paper-back" />
            <div className="paper-front">
              <span>
                WEDDING
                <br />
                DELIVERY
              </span>
              <i />
              <p>
                A story,
                <br />
                beautifully delivered.
              </p>
              <small>YOUR NEXT CHAPTER</small>
              <span className="paper-monogram">d.</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="project-grid">
          {filtered.map((item, index) => (
            <article className="project-card" key={item.id}>
              <button
                className={`project-cover ${item.templateId}`}
                onClick={() => void onOpen(item.id)}
              >
                <span className="cover-top">
                  <span>{getTemplate(item.templateId).name.toUpperCase()} / {item.projectNo}</span>
                  <ArrowUpRight size={18} />
                </span>
                <span className="cover-name">
                  {item.coupleNames || item.title || "待续的故事"}
                </span>
                <span className="cover-bottom">
                  {item.weddingDate
                    ? item.weddingDate.replaceAll("-", " . ")
                    : "WEDDING STORY"}
                  <small>{String(index + 1).padStart(2, "0")}</small>
                </span>
              </button>
              <div className="project-card-info">
                <button
                  className="card-title"
                  onClick={() => void onOpen(item.id)}
                >
                  {item.title || "未命名项目"}
                </button>
                <p>
                  {item.comparisons} 组对比<span>·</span>
                  {dateLabel(item.updatedAt)} 更新
                </p>
                <div className="card-actions">
                  <button
                    className="text-button"
                    onClick={() => void onOpen(item.id)}
                  >
                    继续制作
                    <ArrowRight size={14} />
                  </button>
                  <span>
                    <IconButton
                      label="复制为另一场婚礼"
                      disabled={acting === item.id}
                      onClick={() => void duplicate(item)}
                    >
                      <Copy size={15} />
                    </IconButton>
                    <IconButton
                      label={item.archived ? "恢复项目" : "归档项目"}
                      disabled={acting === item.id}
                      onClick={() => void archive(item)}
                    >
                      {item.archived ? (
                        <Undo2 size={15} />
                      ) : (
                        <Archive size={15} />
                      )}
                    </IconButton>
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <footer className="page-footer">
        <span>CRAFTED FOR THE WAY YOU CREATE.</span>
        <span>项目资料保存在本机</span>
      </footer>
      {creating && (
        <Modal
          title="开始一份新的交付"
          subtitle="方案提供起点，每一项内容都能继续调整。"
          onClose={() => {
            if (!busy) setCreating(false);
          }}
        >
          <form onSubmit={create}>
            <Field label="项目名称" hint="可先留空，稍后在项目中填写。">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                autoFocus
                placeholder="例如：婚礼交付 · 九月"
              />
            </Field>
            <p className="field-label modal-label">选择初始方案</p>
            <div className="preset-options">
              {presets.map((preset) => (
                <label
                  className={`preset-option ${(presetId || presets[0]?.id) === preset.id ? "chosen" : ""}`}
                  key={preset.id}
                >
                  <input
                    type="radio"
                    name="preset"
                    checked={(presetId || presets[0]?.id) === preset.id}
                    onChange={() => setPresetId(preset.id)}
                  />
                  <span>
                    <strong>{preset.name}</strong>
                    <small>
                      {preset.description ||
                        `${preset.blocks.length} 个可编辑章节`}
                    </small>
                  </span>
                  <Check size={17} />
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setCreating(false)}
                disabled={busy}
              >
                取消
              </button>
              <button className="button" disabled={busy}>
                {busy ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <ArrowRight size={16} />
                )}
                创建并开始
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function SettingsPage({
  settings,
  onSaved,
  notify,
  presets,
}: {
  settings: StudioSettings;
  onSaved: (settings: StudioSettings) => void;
  notify: (message: string, error?: boolean) => void;
  presets: Preset[];
}) {
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState(false);
  const change = (key: keyof StudioSettings, value: string) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<StudioSettings>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ settings: draft }),
      });
      onSaved(result);
      notify("工作室资料已保存。新项目将使用这些默认值。");
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page settings-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">YOUR SIGNATURE</p>
          <h1>
            工作室设置<span className="accent-dot">.</span>
          </h1>
          <p className="page-intro">统一品牌的起点，保留每次交付的独立表达。</p>
        </div>
      </header>
      <form className="settings-form" onSubmit={save}>
        <section className="settings-section">
          <div>
            <span className="section-index">01</span>
            <h2>品牌与署名</h2>
            <p>作为新项目的默认资料，已有项目不会被覆盖。</p>
          </div>
          <div className="settings-fields">
            <Field label="工作室名称">
              <input
                required
                value={draft.studioName}
                onChange={(event) => change("studioName", event.target.value)}
                placeholder="你的工作室名称"
              />
            </Field>
            <Field label="摄影师／摄像师署名">
              <input
                value={draft.photographerName}
                onChange={(event) =>
                  change("photographerName", event.target.value)
                }
                placeholder="交付文档中的署名"
              />
            </Field>
            <Field label="品牌短句">
              <input
                value={draft.tagline}
                onChange={(event) => change("tagline", event.target.value)}
                placeholder="以你的语言，为故事落款"
              />
            </Field>
            <Field label="品牌强调色">
              <div className="color-field">
                <input
                  type="color"
                  value={
                    /^#[0-9a-f]{6}$/i.test(draft.accent)
                      ? draft.accent
                      : "#677965"
                  }
                  onChange={(event) => change("accent", event.target.value)}
                />
                <input
                  pattern="#[0-9a-fA-F]{6}"
                  value={draft.accent}
                  onChange={(event) => change("accent", event.target.value)}
                />
              </div>
            </Field>
          </div>
        </section>
        <section className="settings-section">
          <div>
            <span className="section-index">02</span>
            <h2>日期与时间</h2>
            <p>自动交付日期使用工作室时区。</p>
          </div>
          <div className="settings-fields">
            <Field
              label="工作室时区"
              hint="例如 Asia/Shanghai、Asia/Hong_Kong 或 UTC。"
            >
              <input
                required
                value={draft.timezone}
                onChange={(event) => change("timezone", event.target.value)}
                list="timezone-options"
              />
              <datalist id="timezone-options">
                <option value="Asia/Shanghai" />
                <option value="Asia/Hong_Kong" />
                <option value="Asia/Taipei" />
                <option value="UTC" />
              </datalist>
            </Field>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                change(
                  "timezone",
                  Intl.DateTimeFormat().resolvedOptions().timeZone,
                )
              }
            >
              使用这台电脑的时区
              <ArrowUpRight size={14} />
            </button>
          </div>
        </section>
        <div className="settings-submit">
          <button className="button" disabled={busy}>
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Check size={16} />
            )}
            保存工作室资料
          </button>
        </div>
      </form>
      <section className="settings-presets">
        <p className="eyebrow">REUSABLE STARTING POINTS</p>
        <h2>我的交付方案</h2>
        <p className="muted">
          在项目工作台中，将当前内容保存为方案，即可在下次创建时复用。
        </p>
        <div className="preset-list">
          {presets.map((preset) => (
            <div key={preset.id}>
              <Layers size={19} />
              <span>
                <strong>{preset.name}</strong>
                <small>
                  {preset.description || `${preset.blocks.length} 个章节`}
                </small>
              </span>
              <span className="tag">
                {preset.builtin ? "内置" : "我的方案"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

type SlotTarget =
  | { blockId: string; comparisonId: string; side: "before" | "after" }
  | { blockId: string; purpose: "cover" | "evidence" }
  | "logo";

function selectImage(project: ProjectRecord, target: SlotTarget, ref: AssetRef) {
  if (target === "logo") { project.document.brand.logo = ref; return; }
  const block = project.document.blocks.find(item => item.id === target.blockId);
  if ("purpose" in target) {
    if (target.purpose === "cover" && block?.type === "intro") block.cover = { ...createCover(), ...block.cover, image: ref };
    if (target.purpose === "evidence" && block?.type === "text") block.details = { ...createProductionDetails(), placement: "inline", ...block.details, image: ref };
  } else if (block?.type === "comparisons") {
    const comparison = block.comparisons.find(item => item.id === target.comparisonId);
    if (comparison) { comparison[target.side] = ref; comparison.locked = true; }
  }
}
function Workbench({
  initial,
  presets,
  notify,
  refresh,
  leaveGuard,
  onBack,
}: {
  initial: ProjectRecord;
  presets: Preset[];
  notify: (message: string, error?: boolean) => void;
  refresh: () => Promise<void>;
  leaveGuard: React.MutableRefObject<null | (() => Promise<unknown>)>;
  onBack: () => void;
}) {
  const {
    project,
    edit: mutate,
    flush,
    replace,
    saveState,
    saveError,
  } = useProject(initial);
  const [tab, setTab] = useState<WorkTab>("content");
  const [selectedBlock, setSelectedBlock] = useState(
    initial.document.blocks[0]?.id || "",
  );
  const [busy, setBusy] = useState("");
  const [previewTarget, setPreviewTarget] = useState<OutputTarget>("pdf");
  const [previewVisible, setPreviewVisible] = useState(true);
  const [previewRevision, setPreviewRevision] = useState(initial.draftRevision);
  const [previewKey, setPreviewKey] = useState(0);
  const [rule, setRule] = useState<RecognitionRule>("after-first");
  const [rootId, setRootId] = useState("");
  const [includeUnclassified, setIncludeUnclassified] = useState(false);
  const [progress, setProgress] = useState<{
    label: string;
    done: number;
    total: number;
  } | null>(null);
  const [localImportIssues, setLocalImportIssues] = useState<string[]>([]);
  const cancelImport = useRef<AbortController | null>(null);
  const [picker, setPicker] = useState<SlotTarget | null>(null);
  const [candidate, setCandidate] = useState<PreviewCandidate | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [warningsAccepted, setWarningsAccepted] = useState(false);
  const [presetModal, setPresetModal] = useState<"save" | "apply" | null>(null);
  const [presetName, setPresetName] = useState("");
  const [applyId, setApplyId] = useState(presets[0]?.id || "");
  const [undo, setUndo] = useState<Pick<
    ProjectRecord,
    "document" | "excludedSourceKeys"
  > | null>(null);
  const keepUndo = useRef(false);
  const rememberUndo = () => {
    keepUndo.current = true;
    setUndo(
      structuredClone({
        document: project.document,
        excludedSourceKeys: project.excludedSourceKeys,
      }),
    );
  };
  const sortedBlocks = sorted(project.document.blocks);
  const currentBlock =
    sortedBlocks.find((block) => block.id === selectedBlock) || sortedBlocks[0];
  const locked = Boolean(busy);
  const edit = (callback: (draft: ProjectRecord) => void) => {
    if (locked) return;
    if (!keepUndo.current) setUndo(null);
    keepUndo.current = false;
    setCandidate(null);
    setWarningsAccepted(false);
    mutate(callback);
  };
  useEffect(() => {
    leaveGuard.current = async () => {
      if (busy) throw new Error("当前操作尚未结束，请等待完成或取消导入。");
      return flush();
    };
    return () => {
      leaveGuard.current = null;
    };
  }, [flush, busy, leaveGuard]);
  useEffect(() => {
    if (!busy) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [busy]);
  useEffect(() => {
    if (saveState === "saved" && !busy)
      setPreviewRevision(project.draftRevision);
  }, [project.draftRevision, saveState, busy]);
  useEffect(() => {
    if (candidate && candidate.draftRevision !== project.draftRevision)
      setCandidate(null);
  }, [project.draftRevision, candidate]);
  useEffect(() => {
    let disposed = false;
    let loading = false;
    let hasRunningExports = false;
    const controller = new AbortController();
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const records = await api<ExportRecord[]>(
          `/api/projects/${project.id}/exports`,
          { signal: controller.signal },
        );
        if (!disposed) {
          hasRunningExports = records.some(record => record.status === "running");
          setExports(records);
          setHistoryError("");
        }
      } catch (error) {
        if (!disposed) setHistoryError(errorMessage(error));
      } finally {
        loading = false;
      }
    };
    void load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && (exportOpen || hasRunningExports))
        void load();
    }, 3500);
    return () => {
      disposed = true;
      clearInterval(interval);
      controller.abort();
    };
  }, [project.id, exportOpen]);

  const updateBlock = (block: DocumentBlock) =>
    edit((draft) => {
      draft.document.blocks = draft.document.blocks.map((item) =>
        item.id === block.id ? block : item,
      );
    });
  const ensureComparisonBlock = (draft: ProjectRecord): ComparisonBlock => {
    let block = draft.document.blocks.find(
      (item): item is ComparisonBlock => item.type === "comparisons",
    );
    if (!block) {
      block = {
        id: newId(),
        type: "comparisons",
        title: "调色前后",
        visible: true,
        order: draft.document.blocks.length,
        layout: "inherit",
        comparisons: [],
      };
      draft.document.blocks.push(block);
    }
    return block;
  };
  const addBlock = (choice: string) => {
    if (!choice) return;
    const id = newId();
    edit((draft) => {
      let block: DocumentBlock;
      if (choice === "comparisons")
        block = {
          id,
          type: "comparisons",
          title: "调色前后",
          visible: true,
          order: 0,
          layout: "inherit",
          comparisons: [],
        };
      else if (choice === "deliveries")
        block = {
          id,
          type: "deliveries",
          title: "本次交付",
          visible: true,
          order: 0,
          items: [createDeliveryItem()],
        };
      else {
        const definition = CONTENT_LIBRARY.find((item) => item.id === choice);
        block = {
          ...createTextBlock(
            definition?.title || "新的章节",
            definition?.content || "",
          ),
          id,
        };
      }
      block.order = draft.document.blocks.length;
      draft.document.blocks.push(block);
    });
    setSelectedBlock(id);
    setTab("content");
  };
  const assignAsset = (asset: Asset, target: SlotTarget) => {
    const ref: AssetRef = {
      assetId: asset.id,
      versionId: asset.latestVersionId,
    };
    edit((draft) => selectImage(draft, target, ref));
    setPicker(null);
  };
  const refreshRecord = async () => {
    const record = await api<ProjectRecord>(`/api/projects/${project.id}`);
    replace(record);
    return record;
  };
  const processFiles = async (
    selection: FileSelection,
    options: {
      manual?: boolean;
      target?: SlotTarget;
      controller?: AbortController;
    } = {},
  ) => {
    if (cancelImport.current && cancelImport.current !== options.controller) return;
    const controller = options.controller || new AbortController();
    cancelImport.current = controller;
    let importRootId = "";
    let importId = "";
    let latest = project;
    let firstAsset: Asset | null = null;
    let savedForImport = false;
    const failures = [...selection.errors];
    try {
      setBusy("import");
      setCandidate(null);
      setProgress({ label: "正在保存当前修改…", done: 0, total: 0 });
      await flush();
      savedForImport = true;
      if (controller.signal.aborted) return;
      if (!selection.files.length) {
        if (selection.errors.length)
          throw new Error(selection.errors.join("；"));
        notify("没有发现可读取文件");
        return;
      }
      const allImages = selection.files.filter(isDocumentImage);
      const label = options.manual
        ? "手动添加图片"
        : selection.files[0].relativePath.split("/")[0] || "项目资料";
      setLocalImportIssues(failures);
      setProgress({ label: "记录目录与文件信息", done: 0, total: 0 });
      const imported = await post<{
        project: ProjectRecord;
        rootId: string;
        report: ImportReport;
        imagePaths: string[];
        unclassifiedImagePaths: string[];
      }>(
        `/api/projects/${project.id}/imports`,
        {
          rootId: options.manual ? undefined : rootId || undefined,
          label,
          rule: options.manual ? "manual" : rule,
          files: observations(selection.files),
          includeUnclassifiedImages: options.manual
            ? true
            : includeUnclassified,
        },
      );
      const permittedPaths = new Set(imported.imagePaths);
      const images = allImages.filter((item) =>
        permittedPaths.has(item.relativePath),
      );
      importRootId = imported.rootId;
      importId = imported.report.id;
      latest = imported.project;
      replace(latest);
      if (!options.manual) setRootId(importRootId);
      for (let index = 0; index < images.length; index++) {
        if (controller.signal.aborted) break;
        const { file, relativePath } = images[index];
        setProgress({ label: relativePath, done: index, total: images.length });
        const form = new FormData();
        form.append("rootId", importRootId);
        form.append("importId", importId);
        form.append("relativePath", relativePath);
        form.append("file", file);
        try {
          const result = await api<{ project: ProjectRecord; asset: Asset }>(
            `/api/projects/${project.id}/assets`,
            { method: "POST", body: form, signal: controller.signal },
          );
          latest = result.project;
          firstAsset ||= result.asset;
          replace(latest);
        } catch (error) {
          if (controller.signal.aborted) break;
          failures.push(`${relativePath}：${errorMessage(error)}`);
          setLocalImportIssues([...failures]);
        }
        setProgress({
          label: relativePath,
          done: index + 1,
          total: images.length,
        });
      }
      if (options.target && firstAsset && !controller.signal.aborted) {
        const ref: AssetRef = {
          assetId: firstAsset.id,
          versionId: firstAsset.latestVersionId,
        };
        const updated = structuredClone(latest);
        selectImage(updated, options.target, ref);
        latest = await api<ProjectRecord>(`/api/projects/${project.id}`, {
          method: "PUT",
          body: JSON.stringify({
            project: updated,
            expectedRevision: latest.draftRevision,
          }),
        });
        replace(latest);
        setPicker(null);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        failures.push(errorMessage(error));
        setLocalImportIssues([...failures]);
        notify(errorMessage(error), true);
      }
    } finally {
      try {
        if (importRootId) {
          const final = await post<{
            project: ProjectRecord;
            report: ImportReport;
          }>(`/api/projects/${project.id}/imports/${importRootId}/finalize`, {
            importId,
            cancelled: controller.signal.aborted,
          });
          replace(final.project);
        } else if (savedForImport) await refreshRecord();
        if (importRootId)
          notify(
            controller.signal.aborted
              ? "已取消，完成的导入已保留"
              : failures.length
                ? `导入已结束，${failures.length} 项需要查看`
                : "素材已整理，查看配对与导入报告",
          );
      } catch (error) {
        notify(`导入结果需重新核对：${errorMessage(error)}`, true);
      }
      setBusy("");
      setProgress(null);
      cancelImport.current = null;
    }
  };
  const handleDrop = async (transfer: DataTransfer, target?: SlotTarget) => {
    if (locked || cancelImport.current) return;
    const controller = new AbortController();
    cancelImport.current = controller;
    setBusy("scan");
    setProgress({ label: "正在读取目录结构…", done: 0, total: 0 });
    try {
      const selection = await fromDrop(transfer, controller.signal);
      await processFiles(selection, { manual: Boolean(target), target, controller });
    } catch (error) {
      if (!controller.signal.aborted) notify(errorMessage(error), true);
      else notify("已取消目录扫描，未开始导入");
      setBusy("");
      setProgress(null);
      cancelImport.current = null;
    }
  };
  const manualUpload = (files: FileList | null, target?: SlotTarget) => {
    if (files?.length)
      void processFiles(fromInput(files), { manual: true, target });
  };
  const comparisonAction = (
    blockId: string,
    id: string,
    action: "swap" | "hide" | "split" | "delete" | "up" | "down",
  ) => {
    if (
      action === "delete" &&
      !window.confirm(
        "移除此对比关系？图片仍保留，重新扫描也不会自动恢复这组。",
      )
    )
      return;
    rememberUndo();
    edit((draft) => {
      const block = draft.document.blocks.find((item) => item.id === blockId);
      if (block?.type !== "comparisons") return;
      const group = block.comparisons.find((item) => item.id === id);
      if (!group) return;
      if (action === "swap") {
        [group.before, group.after] = [group.after, group.before];
        group.locked = true;
      } else if (action === "hide") group.visible = !group.visible;
      else if (action === "up" || action === "down")
        block.comparisons = reorder(
          block.comparisons,
          sorted(block.comparisons).findIndex((item) => item.id === id),
          action === "up" ? -1 : 1,
        );
      else {
        if (
          group.sourceKey &&
          !draft.excludedSourceKeys.includes(group.sourceKey)
        )
          draft.excludedSourceKeys.push(group.sourceKey);
        block.comparisons = block.comparisons.filter((item) => item.id !== id);
        if (action === "split") {
          const before = createComparison();
          before.before = group.before;
          before.locked = true;
          before.order = block.comparisons.length;
          const after = createComparison();
          after.after = group.after;
          after.locked = true;
          after.order = block.comparisons.length + 1;
          if (before.before) block.comparisons.push(before);
          if (after.after) block.comparisons.push(after);
        }
      }
    });
  };
  const prepare = async () => {
    setExportOpen(true);
    setBusy("prepare");
    setWarningsAccepted(false);
    try {
      const saved = await flush();
      const result = await post<PreviewCandidate>(
        `/api/projects/${project.id}/candidates`,
        { expectedRevision: saved.draftRevision },
      );
      setCandidate(result);
    } catch (error) {
      setCandidate(null);
      notify(errorMessage(error), true);
    } finally {
      setBusy("");
    }
  };
  const generate = async (allowPartial: boolean) => {
    if (!candidate) return;
    setBusy("export");
    try {
      const saved = await flush();
      if (saved.draftRevision !== candidate.draftRevision) {
        setCandidate(null);
        throw new Error("内容已有变化，请重新检查后生成。");
      }
      const result = await post<ExportRecord>(
        `/api/projects/${project.id}/exports`,
        {
          candidateId: candidate.id,
          expectedRevision: saved.draftRevision,
          acknowledgeWarnings: warningsAccepted,
          allowPartial,
        },
      );
      setExports((previous) => [
        result,
        ...previous.filter((record) => record.id !== result.id),
      ]);
      notify(
        result.status === "running"
          ? "正在生成交付文件"
          : result.status === "success"
            ? "交付文件已生成"
            : "请查看各输出的完成情况",
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setCandidate(null);
      notify(errorMessage(error), true);
    } finally {
      setBusy("");
    }
  };
  const retry = async (id: string, target: OutputTarget) => {
    setBusy("retry");
    try {
      const result = await post<ExportRecord>(
        `/api/projects/${project.id}/exports/${id}/retry`,
        { target },
      );
      setExports((previous) =>
        previous.map((record) => (record.id === id ? result : record)),
      );
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy("");
    }
  };
  const presetAction = async () => {
    setBusy("preset");
    try {
      const saved = await flush();
      if (presetModal === "save") {
        await post("/api/presets", {
          projectId: project.id,
          name: presetName.trim(),
        });
        await refresh();
        notify("交付方案已保存，可在创建项目时复用");
      } else {
        setUndo(
          structuredClone({
            document: saved.document,
            excludedSourceKeys: saved.excludedSourceKeys,
          }),
        );
        const record = await post<ProjectRecord>(
          `/api/projects/${project.id}/apply-preset`,
          { presetId: applyId, expectedRevision: saved.draftRevision },
        );
        replace(record);
        setCandidate(null);
        notify("方案已应用，可撤销本次变更");
      }
      setPresetModal(null);
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy("");
    }
  };
  const downloadDraft = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(project, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.projectNo}-未保存草稿.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const reloadSaved = async () => {
    if (locked || !window.confirm("重新载入服务器版本会放弃当前未保存编辑。建议先保存草稿副本。继续？")) return;
    setBusy("reload");
    try {
      await refreshRecord();
      setCandidate(null);
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy("");
    }
  };
  const saveLabels: Record<SaveState, string> = {
    saved: "所有修改已保存",
    pending: "等待保存",
    saving: "正在保存",
    error: "保存失败",
    conflict: "版本冲突",
  };
  const comparisonCount = project.document.blocks.flatMap((block) =>
    block.type === "comparisons" ? block.comparisons : [],
  ).length;
  const assetIssues = project.importReports.at(-1)?.issues || [];

  return (
    <div className="workbench">
      <header className="work-header">
        <div className="work-heading">
          <IconButton label="返回项目" onClick={onBack}>
            <ArrowLeft size={20} />
          </IconButton>
          <div>
            <span className="project-code">{project.projectNo}</span>
            <input
              className="project-title-input"
              aria-label="项目名称"
              value={project.title}
              placeholder="为这份交付命名"
              disabled={locked}
              onChange={(event) =>
                edit((draft) => {
                  draft.title = event.target.value;
                })
              }
            />
          </div>
        </div>
        <div className="work-header-actions">
          <span className={`save-state ${saveState}`} role="status">
            {saveState === "saved" ? (
              <CheckCheck size={15} />
            ) : ["pending", "saving"].includes(saveState) ? (
              <LoaderCircle size={14} className="spin" />
            ) : (
              <AlertCircle size={15} />
            )}
            {saveLabels[saveState]}
          </span>
          <button
            className="button button-small"
            disabled={locked || saveState === "conflict"}
            onClick={() => void prepare()}
          >
            <Download size={15} />
            检查并导出
          </button>
        </div>
      </header>
      {(saveState === "error" || saveState === "conflict") && (
        <div className="save-alert" role="alert">
          <AlertCircle size={17} />
          <span>当前输入尚未保存。{saveError} 请保留此页面。</span>
          <button
            disabled={locked}
            onClick={() =>
              void flush().catch((error) => notify(errorMessage(error), true))
            }
          >
            重试保存
          </button>
          <button onClick={downloadDraft}>保存草稿副本</button>
          <button
            disabled={locked}
            onClick={() => void reloadSaved()}
          >
            载入已保存版本
          </button>
        </div>
      )}
      <div className="work-toolbar">
        <nav className="work-tabs" aria-label="工作台视图">
          <button
            className={tab === "content" ? "selected" : ""}
            onClick={() => setTab("content")}
          >
            <FileText size={16} />
            交付内容
          </button>
          <button
            className={tab === "assets" ? "selected" : ""}
            onClick={() => setTab("assets")}
          >
            <ImageIcon size={16} />
            素材与对比{comparisonCount > 0 && <small>{comparisonCount}</small>}
          </button>
          <button
            className={tab === "visual" ? "selected" : ""}
            onClick={() => setTab("visual")}
          >
            <SlidersHorizontal size={16} />
            视觉与输出
          </button>
        </nav>
        <div className="toolbar-actions">
          {undo && (
            <button
              className="text-button"
              disabled={locked}
              onClick={() => {
                const restore = undo;
                edit((draft) => {
                  draft.document = restore.document;
                  draft.excludedSourceKeys = restore.excludedSourceKeys;
                });
                setUndo(null);
              }}
            >
              <Undo2 size={14} />
              撤销上次调整
            </button>
          )}
          <IconButton
            label={previewVisible ? "收起预览" : "显示预览"}
            onClick={() => setPreviewVisible(!previewVisible)}
          >
            {previewVisible ? (
              <PanelRightClose size={18} />
            ) : (
              <PanelRightOpen size={18} />
            )}
          </IconButton>
        </div>
      </div>
      <div className={`work-body ${previewVisible ? "" : "preview-collapsed"}`}>
        {tab === "content" && (
          <aside className="block-nav">
            <p className="eyebrow">DOCUMENT CHAPTERS</p>
            {sortedBlocks.map((block, index) => (
              <div
                className={`block-nav-item ${currentBlock?.id === block.id ? "active" : ""} ${block.visible ? "" : "is-hidden"}`}
                key={block.id}
              >
                <button onClick={() => setSelectedBlock(block.id)}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {block.title || "未命名章节"}
                </button>
                <IconButton
                  label={block.visible ? "隐藏章节" : "显示章节"}
                  disabled={locked}
                  onClick={() =>
                    updateBlock({ ...block, visible: !block.visible })
                  }
                >
                  {block.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </IconButton>
              </div>
            ))}
            <label className="add-chapter">
              <Plus size={14} />
              <select
                aria-label="添加章节"
                value=""
                disabled={locked}
                onChange={(event) => addBlock(event.target.value)}
              >
                <option value="">添加章节</option>
                <option value="deliveries">交付清单</option>
                <option value="comparisons">调色对比</option>
                {CONTENT_LIBRARY.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
                <option value="custom">自定义文字</option>
              </select>
            </label>
            <div className="block-nav-bottom">
              <button
                className="text-button"
                disabled={locked}
                onClick={() => setPresetModal("apply")}
              >
                <RefreshCw size={13} />
                应用方案
              </button>
              <button
                className="text-button"
                disabled={locked}
                onClick={() => {
                  setPresetName("");
                  setPresetModal("save");
                }}
              >
                <Layers size={13} />
                保存为方案
              </button>
            </div>
          </aside>
        )}
        <section
          className={`editor-pane ${tab !== "content" ? "editor-wide" : ""}`}
        >
          {tab === "content" &&
            (currentBlock ? (
              <fieldset className="editor-fieldset" disabled={locked}>
                <div className="editor-section-heading">
                  <div>
                    <p className="eyebrow">
                      {String(sortedBlocks.indexOf(currentBlock) + 1).padStart(
                        2,
                        "0",
                      )}{" "}
                      / CONTENT
                    </p>
                    <h2>{currentBlock.title}</h2>
                  </div>
                  <div className="inline-actions">
                    <IconButton
                      label="章节上移"
                      disabled={sortedBlocks.indexOf(currentBlock) === 0}
                      onClick={() =>
                        edit((draft) => {
                          draft.document.blocks = reorder(
                            draft.document.blocks,
                            sortedBlocks.indexOf(currentBlock),
                            -1,
                          );
                        })
                      }
                    >
                      <ArrowUp size={15} />
                    </IconButton>
                    <IconButton
                      label="章节下移"
                      disabled={
                        sortedBlocks.indexOf(currentBlock) ===
                        sortedBlocks.length - 1
                      }
                      onClick={() =>
                        edit((draft) => {
                          draft.document.blocks = reorder(
                            draft.document.blocks,
                            sortedBlocks.indexOf(currentBlock),
                            1,
                          );
                        })
                      }
                    >
                      <ArrowDown size={15} />
                    </IconButton>
                    <IconButton
                      label="删除章节"
                      onClick={() => {
                        if (
                          window.confirm(
                            "删除此章节及其内容？此操作不会删除原始图片。",
                          )
                        ) {
                          rememberUndo();
                          edit((draft) => {
                            if (currentBlock.type === "comparisons")
                              for (const group of currentBlock.comparisons)
                                if (
                                  group.sourceKey &&
                                  !draft.excludedSourceKeys.includes(
                                    group.sourceKey,
                                  )
                                )
                                  draft.excludedSourceKeys.push(
                                    group.sourceKey,
                                  );
                            draft.document.blocks =
                              draft.document.blocks.filter(
                                (block) => block.id !== currentBlock.id,
                              );
                          });
                        }
                      }}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                </div>
                {!currentBlock.visible && (
                  <div className="inline-notice">
                    <EyeOff size={15} />
                    此章节已隐藏，内容仍保留。
                  </div>
                )}
                <Field label="章节标题">
                  <input
                    value={currentBlock.title}
                    onChange={(event) =>
                      updateBlock({
                        ...currentBlock,
                        title: event.target.value,
                      })
                    }
                  />
                </Field>
                <BlockEditor
                  block={currentBlock}
                  project={project}
                  edit={edit}
                  update={updateBlock}
                  onAssets={() => setTab("assets")}
                  onPickLogo={() => setPicker("logo")}
                  onPickImage={(purpose) => setPicker({ blockId: currentBlock.id, purpose })}
                />
              </fieldset>
            ) : (
              <Empty
                icon={<FileText size={30} />}
                title="从一个章节开始"
                action={
                  <button
                    className="button button-outline"
                    onClick={() => addBlock("deliveries")}
                  >
                    <Plus size={16} />
                    添加交付清单
                  </button>
                }
              >
                左侧添加交付清单、制作说明或调色对比。
              </Empty>
            ))}
          {tab === "assets" && (
            <AssetsEditor
              project={project}
              includeUnclassified={includeUnclassified}
              setIncludeUnclassified={setIncludeUnclassified}
              locked={locked}
              rule={rule}
              setRule={setRule}
              rootId={rootId}
              setRootId={(id) => {
                setRootId(id);
                const root = project.importRoots.find((item) => item.id === id);
                if (root) setRule(root.rule);
              }}
              progress={progress}
              localIssues={localImportIssues}
              onCancel={() => cancelImport.current?.abort()}
              onFiles={(files) => void processFiles(fromInput(files))}
              onDrop={handleDrop}
              onManual={(files) => manualUpload(files)}
              onPick={setPicker}
              onComparison={comparisonAction}
              onAdd={() =>
                edit((draft) => {
                  const block = ensureComparisonBlock(draft);
                  const comparison = createComparison();
                  comparison.order = block.comparisons.length;
                  comparison.locked = true;
                  block.comparisons.push(comparison);
                })
              }
              onEdit={edit}
              onAccept={async (asset, versionId) => {
                setBusy("version");
                try {
                  const saved = await flush();
                  const updated = await post<ProjectRecord>(
                    `/api/projects/${project.id}/assets/${asset.id}/accept-version`,
                    { versionId, expectedRevision: saved.draftRevision },
                  );
                  replace(updated);
                  setCandidate(null);
                } catch (error) {
                  notify(errorMessage(error), true);
                } finally {
                  setBusy("");
                }
              }}
            />
          )}
          {tab === "visual" && (
            <fieldset className="editor-fieldset" disabled={locked}>
              <VisualEditor project={project} edit={edit} />
            </fieldset>
          )}
        </section>
        {previewVisible && (
          <aside className="preview-pane">
            <div className="preview-heading">
              <span>
                <Eye size={15} />
                手机阅读预览
              </span>
              <div className="segmented">
                <button
                  className={previewTarget === "pdf" ? "active" : ""}
                  aria-pressed={previewTarget === "pdf"}
                  onClick={() => setPreviewTarget("pdf")}
                >
                  PDF
                </button>
                <button
                  className={previewTarget === "image" ? "active" : ""}
                  aria-pressed={previewTarget === "image"}
                  onClick={() => setPreviewTarget("image")}
                >
                  长图
                </button>
              </div>
            </div>
            <div className="preview-stage">
              <div className="phone-frame">
                <div className="phone-status">
                  <span>9:41</span>
                  <span>● ▰</span>
                </div>
                <QuickPreview
                  src={`/api/projects/${project.id}/preview?target=${previewTarget}&revision=${previewRevision}`}
                  refreshKey={previewKey}
                />
                <div className="phone-home" />
              </div>
            </div>
            <p className="preview-caption">
              {saveState === "saved" && previewRevision === project.draftRevision
                ? "快速预览 · 正式分页请查看导出检查"
                : "当前显示上次保存内容 · 正在等待保存"}
              <button
                onClick={() => {
                  setPreviewKey((value) => value + 1);
                }}
                aria-label="刷新预览"
              >
                <RefreshCw size={12} />
              </button>
            </p>
            <div className="preview-footer">
              <span>
                {getTemplate(project.document.templateId).label} · {getTemplate(project.document.templateId).name}
              </span>
              <span>
                {project.document.comparisonLayout === "stacked"
                  ? "上下对比"
                  : "左右对比"}
              </span>
            </div>
          </aside>
        )}
      </div>
      {picker && (
        <AssetPicker
          project={project}
          target={picker}
          locked={locked}
          onClose={() => {
            if (!locked) setPicker(null);
          }}
          onSelect={(asset) => assignAsset(asset, picker)}
          onUpload={(files) => manualUpload(files, picker)}
          onDrop={(transfer) => void handleDrop(transfer, picker)}
        />
      )}
      {presetModal && (
        <Modal
          title={presetModal === "save" ? "保存为交付方案" : "应用另一个方案"}
          onClose={() => {
            if (!locked) setPresetModal(null);
          }}
        >
          <div className="modal-content">
            {presetModal === "save" ? (
              <>
                <Field label="方案名称">
                  <input
                    value={presetName}
                    onChange={(event) => setPresetName(event.target.value)}
                    placeholder="例如：电影双机位交付"
                    autoFocus
                  />
                </Field>
                <p className="muted">
                  保存章节、通用文案与视觉设置。客户信息、项目图片和客户链接不会进入方案。
                </p>
              </>
            ) : (
              <>
                <Field label="选择方案">
                  <select
                    value={applyId}
                    onChange={(event) => setApplyId(event.target.value)}
                  >
                    {presets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="inline-notice warning">
                  <AlertCircle size={18} />
                  <span>
                    将用所选方案替换当前 {project.document.blocks.length}{" "}
                    个章节、文案与模板设置，已有章节编辑和配对会从文档移除。客户资料、图片库、日期与输出设置保留。操作完成后可以撤销。
                  </span>
                </div>
                <p className="muted">
                  新方案包含：
                  {presets
                    .find((preset) => preset.id === applyId)
                    ?.blocks.map((block) => block.title)
                    .join("、") || "空白文档"}
                </p>
              </>
            )}
            <div className="modal-actions">
              <button
                className="button button-ghost"
                onClick={() => setPresetModal(null)}
                disabled={locked}
              >
                取消
              </button>
              <button
                className="button"
                disabled={
                  locked ||
                  (presetModal === "save" ? !presetName.trim() : !applyId)
                }
                onClick={() => void presetAction()}
              >
                {locked ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  <Check size={15} />
                )}
                {presetModal === "save" ? "保存方案" : "确认应用"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {exportOpen && (
        <ExportDialog
          project={project}
          historyError={historyError}
          onRefreshHistory={async () => {
            try {
              setExports(
                await api<ExportRecord[]>(
                  `/api/projects/${project.id}/exports`,
                ),
              );
              setHistoryError("");
            } catch (error) {
              setHistoryError(errorMessage(error));
            }
          }}
          candidate={candidate}
          busy={busy}
          exports={exports}
          warningsAccepted={warningsAccepted}
          setWarningsAccepted={setWarningsAccepted}
          onClose={() => {
            if (!["prepare", "export"].includes(busy)) setExportOpen(false);
          }}
          onPrepare={() => void prepare()}
          onGenerate={(partial) => void generate(partial)}
          onRetry={(id, target) => void retry(id, target)}
          onIssue={(issue) => {
            if (issue.blockId) setSelectedBlock(issue.blockId);
            setTab(issue.comparisonId || issue.assetId ? "assets" : "content");
            setExportOpen(false);
          }}
        />
      )}
    </div>
  );
}

function DocumentImage({ project, image, label, onPick, onRemove }: {
  project: ProjectRecord; image: AssetRef | null; label: string; onPick: () => void; onRemove: () => void;
}) {
  return <div className="document-image-editor">
    {image && <img src={`/api/projects/${project.id}/assets/${image.versionId}`} alt={label} />}
    <div className="inline-actions">
      <button className="button button-outline button-small" onClick={onPick}><ImagePlus size={16} />{image ? `替换${label}` : `选择${label}`}</button>
      {image && <button className="text-button danger" onClick={onRemove}>移除{label}</button>}
    </div>
  </div>;
}

function CoverEditor({ project, block, update, onPick }: {
  project: ProjectRecord; block: Extract<DocumentBlock, { type: "intro" }>;
  update: (block: DocumentBlock) => void; onPick: () => void;
}) {
  const cover = block.cover ?? createCover();
  const change = (values: Partial<typeof cover>) => update({ ...block, cover: { ...cover, ...values } });
  return <div className="cover-editor">
    <div className="field-divider"><span>封面与寄语</span><small>图片保留完整构图</small></div>
    <Field label="封面版式"><select aria-label="封面版式" value={block.cover ? cover.emphasis : "template"} onChange={event => {
      if (event.target.value === "template") { const next = { ...block }; delete next.cover; update(next); }
      else change({ emphasis: event.target.value as "names" | "photo" });
    }}><option value="template">模板默认</option><option value="names">姓名主导 · 信息在前</option><option value="photo">照片主导 · 画面在前</option></select></Field>
    <Field label="封面短句"><input maxLength={120} value={block.cover?.headline ?? ""} placeholder="属于你们的婚礼影像。" onChange={event => change({ headline: event.target.value })} /></Field>
    <Field label="开篇寄语"><textarea maxLength={600} rows={3} value={cover.message} placeholder="写给这一次婚礼的短短几句话。" onChange={event => change({ message: event.target.value })} /></Field>
    <DocumentImage project={project} image={cover.image} label="封面图" onPick={onPick} onRemove={() => change({ image: null })} />
    <p className="field-hint">选择项目中的成片，或上传一张代表性画面。切换版式不会裁切照片。</p>
  </div>;
}

function ProductionEditor({ project, block, update, onPick }: {
  project: ProjectRecord; block: Extract<DocumentBlock, { type: "text" }>;
  update: (block: DocumentBlock) => void; onPick: () => void;
}) {
  const details = block.details ?? createProductionDetails();
  const change = (values: Partial<typeof details>) => update({ ...block, details: { ...details, ...values } });
  return <div className="production-editor">
    <div className="field-divider"><span>制作详情与证据</span><small>可选</small></div>
    <Field label="制作详情位置"><select aria-label="制作详情位置" value={details.placement} onChange={event => change({ placement: event.target.value as typeof details.placement })}><option value="hidden">本次不展示</option><option value="inline">紧随本节正文</option><option value="appendix">放入文末制作附录</option></select></Field>
    <Field label="技术说明"><textarea rows={4} value={details.content} placeholder="说明具体处理方式与依据；以本次实际制作为准。" onChange={event => change({ content: event.target.value })} /></Field>
    <DocumentImage project={project} image={details.image} label="制作说明图" onPick={onPick} onRemove={() => change({ image: null })} />
    <Field label="制作图说明"><textarea rows={2} maxLength={2000} value={details.caption} placeholder="解释这张截图展示了什么，以及客户应该关注哪里。" onChange={event => change({ caption: event.target.value })} /></Field>
    <p className="field-hint">选择“本次不展示”后，技术说明与图片都不会进入客户预览或导出。</p>
  </div>;
}

function BlockEditor({
  block,
  project,
  edit,
  update,
  onAssets,
  onPickLogo,
  onPickImage,
}: {
  block: DocumentBlock;
  project: ProjectRecord;
  edit: (callback: (draft: ProjectRecord) => void) => void;
  update: (block: DocumentBlock) => void;
  onAssets: () => void;
  onPickLogo: () => void;
  onPickImage: (purpose: "cover" | "evidence") => void;
}) {
  const fields = project.document.fields;
  const field = (key: keyof typeof fields, value: VisibleText) =>
    edit((draft) => {
      draft.document.fields[key] = value;
    });
  if (block.type === "intro")
    return (
      <div className="block-editor-content">
        <div className="field-divider">
          <span>客户与婚礼</span>
          <small>眼睛图标控制是否出现在交付中</small>
        </div>
        <VisibleField
          label="交付显示编号"
          field={fields.projectNo}
          onChange={(value) => field("projectNo", value)}
          placeholder="项目编号或本次交付编号"
        />
        <VisibleField
          label="客户称呼"
          field={fields.salutation}
          onChange={(value) => field("salutation", value)}
          placeholder="例如：亲爱的两位新人"
        />
        <VisibleField
          label="新人姓名"
          field={fields.coupleNames}
          onChange={(value) => field("coupleNames", value)}
          placeholder="填写你希望客户看到的姓名"
        />
        <VisibleField
          label="婚礼日期"
          type="date"
          field={fields.weddingDate}
          onChange={(value) => field("weddingDate", value)}
        />
        <div className="field-divider">
          <span>交付日期</span>
          <IconButton
            label={
              project.document.deliveryDate.visible
                ? "隐藏交付日期"
                : "显示交付日期"
            }
            onClick={() =>
              edit((draft) => {
                draft.document.deliveryDate.visible =
                  !draft.document.deliveryDate.visible;
              })
            }
          >
            {project.document.deliveryDate.visible ? (
              <Eye size={16} />
            ) : (
              <EyeOff size={16} />
            )}
          </IconButton>
        </div>
        <div className="segmented date-mode">
          <button
            className={
              project.document.deliveryDate.mode === "auto" ? "active" : ""
            }
            onClick={() =>
              edit((draft) => {
                draft.document.deliveryDate.mode = "auto";
              })
            }
          >
            自动使用交付当天
          </button>
          <button
            className={
              project.document.deliveryDate.mode === "manual" ? "active" : ""
            }
            onClick={() =>
              edit((draft) => {
                draft.document.deliveryDate.mode = "manual";
              })
            }
          >
            手动指定
          </button>
        </div>
        {project.document.deliveryDate.mode === "manual" ? (
          <Field label="指定交付日期">
            <input
              type="date"
              value={project.document.deliveryDate.manualDate}
              onChange={(event) =>
                edit((draft) => {
                  draft.document.deliveryDate.manualDate = event.target.value;
                })
              }
            />
          </Field>
        ) : (
          <p className="field-hint">
            正式预览时按工作室时区确定，PDF 与长图保持一致。
          </p>
        )}
        <CoverEditor project={project} block={block} update={update} onPick={() => onPickImage("cover")} />
        <div className="field-divider">
          <span>内部记录</span>
          <span className="tag">仅自己可见</span>
        </div>
        <Field label="内部备注">
          <textarea
            value={project.internalNotes}
            onChange={(event) =>
              edit((draft) => {
                draft.internalNotes = event.target.value;
              })
            }
            placeholder="拍摄信息、沟通记录……不会出现在客户交付中。"
            rows={3}
          />
        </Field>
      </div>
    );
  if (block.type === "text")
    return (
      <div className="block-editor-content">
        <Field label="正文内容" hint="按段落写作，排版交给模板。">
          <textarea
            className="prose-textarea"
            rows={11}
            value={block.content}
            onChange={(event) =>
              update({ ...block, content: event.target.value })
            }
            placeholder="在这里写下这次交付需要说明的内容。"
          />
        </Field>
        <div className="editor-tip">
          <Sparkles size={16} />
          <span>切换模板不改变你的文字。先写客户能感受到的效果，再补充制作细节。</span>
        </div>
        <ProductionEditor project={project} block={block} update={update} onPick={() => onPickImage("evidence")} />
      </div>
    );
  if (block.type === "signature")
    return (
      <div className="block-editor-content">
        <VisibleField
          label="工作室名称"
          field={fields.studioName}
          onChange={(value) => field("studioName", value)}
          placeholder="工作室名称"
        />
        <VisibleField
          label="摄影师／摄像师署名"
          field={fields.photographerName}
          onChange={(value) => field("photographerName", value)}
          placeholder="署名"
        />
        <Field label="品牌短句">
          <input
            value={project.document.brand.tagline}
            onChange={(event) =>
              edit((draft) => {
                draft.document.brand.tagline = event.target.value;
              })
            }
            placeholder="为这份故事留下一句落款"
          />
        </Field>
        <div className="field-divider">
          <span>品牌 Logo</span>
        </div>
        {project.document.brand.logo ? (
          <div className="logo-preview">
            <img
              src={`/api/projects/${project.id}/assets/${project.document.brand.logo.versionId}`}
              alt="当前品牌 Logo"
            />
            <button className="text-button" onClick={onPickLogo}>
              替换
            </button>
            <button
              className="text-button danger"
              onClick={() =>
                edit((draft) => {
                  draft.document.brand.logo = null;
                })
              }
            >
              取消 Logo
            </button>
          </div>
        ) : (
          <button className="upload-logo" onClick={onPickLogo}>
            <ImagePlus size={23} />
            <span>
              添加品牌 Logo<small>没有 Logo 时，使用文字品牌</small>
            </span>
          </button>
        )}
      </div>
    );
  if (block.type === "comparisons") {
    const complete = block.comparisons.filter(
      (group) => group.before && group.after,
    ).length;
    return (
      <div className="block-editor-content">
        <div className="comparison-summary">
          <span>{complete.toString().padStart(2, "0")}</span>
          <div>
            <strong>组完整对比</strong>
            <p>
              共 {block.comparisons.length} 组，图片关联通过素材工作台管理。
            </p>
          </div>
        </div>
        <Field label="本章节布局">
          <select
            value={block.layout}
            onChange={(event) =>
              update({
                ...block,
                layout: event.target.value as ComparisonBlock["layout"],
              })
            }
          >
            <option value="inherit">跟随文档设置</option>
            <option value="stacked">Stacked · 上下展示</option>
            <option value="split">Split · 左右展示</option>
          </select>
        </Field>
        <button className="button button-outline" onClick={onAssets}>
          <ImageIcon size={16} />
          整理对比图片
          <ArrowRight size={16} />
        </button>
        {!block.comparisons.length && block.visible && (
          <div className="inline-notice warning">
            <AlertCircle size={17} />
            此章节暂时没有对比图。添加图片，或关闭左侧章节显示。
          </div>
        )}
      </div>
    );
  }
  const updateItem = (id: string, change: Partial<DeliveryItem>) =>
    update({
      ...block,
      items: block.items.map((item) =>
        item.id === id ? { ...item, ...change } : item,
      ),
    });
  return (
    <div className="block-editor-content">
      <p className="muted compact">
        列出本次实际交付的内容，素材目录不会自动改变这份清单。
      </p>
      <div className="delivery-items">
        {sorted(block.items).map((item, index) => (
          <div
            className={`delivery-item ${item.visible ? "" : "is-hidden"}`}
            key={item.id}
          >
            <div className="delivery-item-top">
              <span className="item-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <input
                aria-label={`交付条目 ${index + 1} 标题`}
                value={item.title}
                onChange={(event) =>
                  updateItem(item.id, { title: event.target.value })
                }
                placeholder="交付内容标题"
              />
              <IconButton
                label={item.visible ? "隐藏交付条目" : "显示交付条目"}
                onClick={() => updateItem(item.id, { visible: !item.visible })}
              >
                {item.visible ? <Eye size={15} /> : <EyeOff size={15} />}
              </IconButton>
            </div>
            <div className="delivery-item-fields">
              <Field label="说明">
                <textarea
                  rows={2}
                  value={item.description}
                  onChange={(event) =>
                    updateItem(item.id, { description: event.target.value })
                  }
                  placeholder="关于这一份作品的说明"
                />
              </Field>
              <div className="form-grid">
                <Field label="文件格式">
                  <input
                    value={item.format}
                    onChange={(event) =>
                      updateItem(item.id, { format: event.target.value })
                    }
                    placeholder="例如：4K · MP4"
                  />
                </Field>
                <Field label="交付方式">
                  <select
                    value={item.method}
                    onChange={(event) =>
                      updateItem(item.id, {
                        method: event.target.value as DeliveryItem["method"],
                      })
                    }
                  >
                    <option value="link">外部链接</option>
                    <option value="description">仅作说明</option>
                    <option value="offline">线下交接</option>
                    <option value="attachment" disabled>
                      附件打包（后续支持）
                    </option>
                  </select>
                </Field>
              </div>
              {item.method === "link" && (
                <>
                  <Field label="下载链接">
                    <input
                      type="url"
                      value={item.downloadUrl}
                      onChange={(event) =>
                        updateItem(item.id, { downloadUrl: event.target.value })
                      }
                      placeholder="粘贴百度网盘等分享链接"
                    />
                  </Field>
                  <Field label="播放链接（可选）">
                    <input
                      type="url"
                      value={item.playbackUrl}
                      onChange={(event) =>
                        updateItem(item.id, { playbackUrl: event.target.value })
                      }
                      placeholder="https://"
                    />
                  </Field>
                  <Field label="取件说明／提取码">
                    <input
                      value={item.accessNote}
                      onChange={(event) =>
                        updateItem(item.id, { accessNote: event.target.value })
                      }
                      placeholder="客户需要知道的获取方式"
                    />
                  </Field>
                </>
              )}
              {item.method === "attachment" && (
                <p className="field-hint">
                  此项目使用了尚未支持的附件方式。请改为外部链接、线下交接或仅作说明。
                </p>
              )}
              <div className="item-footer">
                <span>{item.visible ? "在交付中显示" : "本次隐藏"}</span>
                <span>
                  <IconButton
                    label="条目上移"
                    disabled={index === 0}
                    onClick={() =>
                      update({
                        ...block,
                        items: reorder(block.items, index, -1),
                      })
                    }
                  >
                    <ArrowUp size={14} />
                  </IconButton>
                  <IconButton
                    label="条目下移"
                    disabled={index === block.items.length - 1}
                    onClick={() =>
                      update({
                        ...block,
                        items: reorder(block.items, index, 1),
                      })
                    }
                  >
                    <ArrowDown size={14} />
                  </IconButton>
                  <IconButton
                    label="删除交付条目"
                    onClick={() => {
                      if (
                        window.confirm(`移除“${item.title || "此交付条目"}”？`)
                      )
                        update({
                          ...block,
                          items: block.items.filter(
                            (row) => row.id !== item.id,
                          ),
                        });
                    }}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button
        className="add-item"
        onClick={() => {
          const item = createDeliveryItem();
          item.order = block.items.length;
          update({ ...block, items: [...block.items, item] });
        }}
      >
        <Plus size={16} />
        添加交付内容
      </button>
    </div>
  );
}

function TemplateSample({ id }: { id: TemplateId }) {
  return <img className="template-render-preview" src={`/template-previews/${id}.png`} alt="" loading="lazy" />;
}

function VisualEditor({
  project,
  edit,
}: {
  project: ProjectRecord;
  edit: (callback: (draft: ProjectRecord) => void) => void;
}) {
  const doc = project.document;
  return (
    <div className="visual-editor">
      <div className="editor-section-heading">
        <div>
          <p className="eyebrow">THE LOOK & FEEL</p>
          <h2>为故事选择一种表达</h2>
        </div>
      </div>
      <p className="muted">
        视觉、图片布局与输出方式各自独立，内容始终是同一份。
      </p>
      <h3 className="option-heading">
        <span>01</span>视觉模板
      </h3>
      <div className="template-options">
        {TEMPLATES.map((template) => (
          <button
            className={`template-card ${doc.templateId === template.id ? "selected" : ""}`}
            key={template.id}
            data-template={template.id}
            aria-pressed={doc.templateId === template.id}
            onClick={() =>
              edit((draft) => {
                draft.document.templateId = template.id;
                draft.document.templateVersion = 1;
              })
            }
          >
            <TemplateSample id={template.id} />
            <span className="template-card-label">
              <span>
                <strong>
                  {template.name}
                </strong>
                <small>
                  {template.label}
                </small>
              </span>
              {doc.templateId === template.id ? (
                <CheckCircle2 size={19} />
              ) : (
                <Circle size={19} />
              )}
            </span>
            <span className="template-description">{template.description}</span>
          </button>
        ))}
      </div>
      <h3 className="option-heading">
        <span>02</span>对比图片布局
      </h3>
      <div className="layout-options">
        <button
          className={doc.comparisonLayout === "stacked" ? "selected" : ""}
          onClick={() =>
            edit((draft) => {
              draft.document.comparisonLayout = "stacked";
            })
          }
        >
          <span className="layout-glyph stacked">
            <i />
            <i />
          </span>
          <span>
            <strong>Stacked · 上下</strong>
            <small>适合手机查看细节</small>
          </span>
          {doc.comparisonLayout === "stacked" && <Check size={16} />}
        </button>
        <button
          className={doc.comparisonLayout === "split" ? "selected" : ""}
          onClick={() =>
            edit((draft) => {
              draft.document.comparisonLayout = "split";
            })
          }
        >
          <span className="layout-glyph split">
            <i />
            <i />
          </span>
          <span>
            <strong>Split · 左右</strong>
            <small>同屏比较两种画面</small>
          </span>
          {doc.comparisonLayout === "split" && <Check size={16} />}
        </button>
      </div>
      <p className="field-hint">
        已单独设置布局的章节保留自己的选择。图片完整显示，不自动裁切。
      </p>
      <h3 className="option-heading">
        <span>03</span>本次输出
      </h3>
      <div className="output-options">
        {(["pdf", "both", "image"] as const).map((mode) => (
          <button
            className={doc.output.mode === mode ? "selected" : ""}
            key={mode}
            onClick={() =>
              edit((draft) => {
                draft.document.output.mode = mode;
              })
            }
          >
            {mode === "pdf" ? (
              <FileText size={20} />
            ) : mode === "image" ? (
              <FileImage size={20} />
            ) : (
              <Layers size={20} />
            )}
            <strong>{labels[mode]}</strong>
            {doc.output.mode === mode && <CheckCircle2 size={16} />}
          </button>
        ))}
      </div>
      <div className="output-details">
        <div className="form-grid">
          <Field label="长图宽度">
            <select
              value={doc.output.imageWidth}
              onChange={(event) =>
                edit((draft) => {
                  draft.document.output.imageWidth = Number(event.target.value);
                })
              }
            >
              {[720, 1080, 1440].map((width) => (
                <option key={width} value={width}>
                  {width} px
                </option>
              ))}
            </select>
          </Field>
          <Field label="分段高度预算">
            <select
              value={doc.output.segmentHeight}
              onChange={(event) =>
                edit((draft) => {
                  draft.document.output.segmentHeight = Number(
                    event.target.value,
                  );
                })
              }
            >
              {[4000, 8000, 12000, 16000].map((height) => (
                <option key={height} value={height}>
                  {height.toLocaleString()} px
                </option>
              ))}
            </select>
          </Field>
        </div>
        <CheckRow
          checked={doc.output.allowImageSegments}
          onChange={(value) =>
            edit((draft) => {
              draft.document.output.allowImageSegments = value;
            })
          }
          hint="超过高度预算时，按安全内容边界分为多张；正式预览显示分段结果。"
        >
          允许长图分段
        </CheckRow>
        <CheckRow
          checked={doc.output.allowComparisonPageBreak}
          onChange={(value) =>
            edit((draft) => {
              draft.document.output.allowComparisonPageBreak = value;
            })
          }
          hint="一页无法清楚容纳时，允许 Before / After 在连续两页显示。"
        >
          允许过高对比分页
        </CheckRow>
      </div>
      <div className="editor-tip">
        <FileText size={16} />
        <span>
          PDF
          保留可点击链接；长图使用二维码与取件说明。生成前会检查所有所选输出。
        </span>
      </div>
    </div>
  );
}

function AssetsEditor({
  project,
  includeUnclassified,
  setIncludeUnclassified,
  locked,
  rule,
  setRule,
  rootId,
  setRootId,
  progress,
  localIssues,
  onCancel,
  onFiles,
  onDrop,
  onManual,
  onPick,
  onComparison,
  onAdd,
  onEdit,
  onAccept,
}: {
  project: ProjectRecord;
  includeUnclassified: boolean;
  setIncludeUnclassified: (value: boolean) => void;
  locked: boolean;
  rule: RecognitionRule;
  setRule: (value: RecognitionRule) => void;
  rootId: string;
  setRootId: (value: string) => void;
  progress: { label: string; done: number; total: number } | null;
  localIssues: string[];
  onCancel: () => void;
  onFiles: (files: FileList) => void;
  onDrop: (transfer: DataTransfer, target?: SlotTarget) => Promise<void>;
  onManual: (files: FileList | null) => void;
  onPick: (target: SlotTarget) => void;
  onComparison: (
    blockId: string,
    id: string,
    action: "swap" | "hide" | "split" | "delete" | "up" | "down",
  ) => void;
  onAdd: () => void;
  onEdit: (callback: (draft: ProjectRecord) => void) => void;
  onAccept: (asset: Asset, versionId: string) => Promise<void>;
}) {
  const folderInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const groups = sorted(project.document.blocks).flatMap((block) =>
    block.type === "comparisons"
      ? sorted(block.comparisons).map((comparison) => ({ block, comparison }))
      : [],
  );
  const report = project.importReports.at(-1);
  const problems = groups.filter(
    ({ block, comparison }) =>
      block.visible &&
      comparison.visible &&
      (!comparison.before || !comparison.after),
  );
  const shown = onlyProblems ? problems : groups;
  const assignDrop = (
    transfer: DataTransfer,
    target: Extract<SlotTarget, { comparisonId: string }>,
  ) => {
    const assetId = transfer.getData("application/x-studio-asset");
    if (assetId) {
      const asset = project.assets.find((item) => item.id === assetId);
      if (!asset) return;
      onEdit((draft) => {
        const block = draft.document.blocks.find(
          (item) => item.id === target.blockId,
        );
        if (block?.type !== "comparisons") return;
        const group = block.comparisons.find(
          (item) => item.id === target.comparisonId,
        );
        if (group) {
          group[target.side] = {
            assetId: asset.id,
            versionId: asset.latestVersionId,
          };
          group.locked = true;
        }
      });
    } else void onDrop(transfer, target);
  };
  return (
    <div className="assets-editor">
      <div className="editor-section-heading">
        <div>
          <p className="eyebrow">GATHER THE DETAILS</p>
          <h2>整理素材，也整理最后的细节</h2>
        </div>
      </div>
      <div className="import-settings">
        <Field label="识别方式">
          <select
            value={rule}
            disabled={locked}
            onChange={(event) => setRule(event.target.value as RecognitionRule)}
          >
            <option value="after-first">尾号 -1 调色后 / -2 原图</option>
            <option value="before-first">尾号 -1 原图 / -2 调色后</option>
            <option value="words">before / after 命名</option>
            <option value="manual">仅导入，由我手动配对</option>
          </select>
        </Field>
        <Field label="导入来源">
          <select
            value={rootId}
            disabled={locked}
            onChange={(event) => setRootId(event.target.value)}
          >
            <option value="">作为新文件夹导入</option>
            {project.importRoots.map((root) => (
              <option value={root.id} key={root.id}>
                重新扫描 · {root.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <CheckRow
        checked={includeUnclassified}
        onChange={(value) => {
          if (!locked) setIncludeUnclassified(value);
        }}
        hint="默认仅导入规则识别或调色对比目录中的图片。勾选后也会导入其他 JPEG / PNG，可能占用较多磁盘空间。"
      >
        同时导入未识别图片
      </CheckRow>
      <input
        ref={folderInput}
        type="file"
        multiple
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        hidden
        onChange={(event) => {
          if (event.target.files) onFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        multiple
        hidden
        onChange={(event) => {
          onManual(event.target.files);
          event.target.value = "";
        }}
      />
      <div
        className={`folder-drop ${dragging ? "dragging" : ""} ${progress ? "importing" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!locked) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!locked) void onDrop(event.dataTransfer);
        }}
      >
        {progress ? (
          <>
            <LoaderCircle size={28} className="spin" />
            <h3>
              {progress.total
                ? `正在导入 ${progress.done} / ${progress.total} 张文档图片`
                : "正在分析目录"}
            </h3>
            <p className="progress-filename">{progress.label}</p>
            <div className="progress-track">
              <span
                style={{
                  width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 12}%`,
                }}
              />
            </div>
            <button className="text-button" onClick={onCancel}>
              取消本次操作
            </button>
          </>
        ) : (
          <>
            <FolderOpen size={34} strokeWidth={1.3} />
            <h3>将整个项目文件夹拖到这里</h3>
            <p>扫描目录信息，仅导入识别到的文档图片。完整视频留在原处。</p>
            <button
              className="button button-outline button-small"
              disabled={locked}
              onClick={() => folderInput.current?.click()}
            >
              <Folder size={15} />
              {rootId ? "选择原文件夹重新扫描" : "选择项目文件夹"}
            </button>
            <small>
              当前识别：
              {rule === "after-first"
                ? "-1 是 After，-2 是 Before"
                : rule === "before-first"
                  ? "-1 是 Before，-2 是 After"
                  : rule === "words"
                    ? "按 before / after 文字识别"
                    : "不自动建立配对"}
            </small>
          </>
        )}
      </div>
      {report && (
        <div className="import-report">
          <div className="report-heading">
            <CheckCircle2 size={17} />
            <strong>
              {report.cancelled
                ? "导入已取消 · 已完成部分保留"
                : "最近一次整理结果"}
            </strong>
            <span>{dateLabel(report.createdAt)}</span>
          </div>
          <div className="report-stats">
            <span>
              <strong>{report.scanned}</strong>发现文件
            </span>
            <span>
              <strong>{report.imported}</strong>导入图片
            </span>
            <span>
              <strong>{report.reused}</strong>复用素材
            </span>
            <span>
              <strong>{report.paired}</strong>建立配对
            </span>
            <span>
              <strong>{report.videos}</strong>视频仅索引
            </span>
          </div>
          {(report.issues.length > 0 || localIssues.length > 0) && (
            <details open>
              <summary>
                <AlertCircle size={15} />
                查看 {report.issues.length + localIssues.length} 项提醒与异常
              </summary>
              <ul>
                {report.issues.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>
                    <strong>{issue.message}</strong>
                    {issue.paths.length > 0 && (
                      <small>{issue.paths.join("、")}</small>
                    )}
                  </li>
                ))}
                {localIssues.map((issue, index) => (
                  <li key={`local-${index}`}>{issue}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {!report && localIssues.length > 0 && (
        <div className="inline-notice warning">
          <AlertCircle size={17} />
          <div>
            {localIssues.map((issue, index) => (
              <p key={index}>{issue}</p>
            ))}
          </div>
        </div>
      )}
      <div className="asset-section-heading">
        <div>
          <h3>
            调色对比 <span>{groups.length}</span>
          </h3>
          <p>
            {problems.length
              ? `${problems.length} 组缺图，需要补充或明确隐藏。`
              : groups.length
                ? "已匹配结果直接采用，随时可以调整。"
                : "需要展示调色过程时，再创建对比组。"}
          </p>
        </div>
        <button
          className="button button-outline button-small"
          disabled={locked}
          onClick={onAdd}
        >
          <Plus size={15} />
          手动建组
        </button>
      </div>
      {groups.length > 0 && (
        <CheckRow checked={onlyProblems} onChange={setOnlyProblems}>
          只看需要处理的组
        </CheckRow>
      )}
      <div className="comparison-grid">
        {shown.map(({ block, comparison }, index) => (
          <article
            className={`comparison-card ${comparison.visible && block.visible ? "" : "is-hidden"}`}
            key={comparison.id}
          >
            <div className="comparison-card-header">
              <span className="item-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <input
                aria-label={`对比组 ${index + 1} 名称`}
                value={comparison.title}
                placeholder="调色对比"
                disabled={locked}
                onChange={(event) =>
                  onEdit((draft) => {
                    const target = draft.document.blocks.find(
                      (item) => item.id === block.id,
                    );
                    if (target?.type === "comparisons") {
                      const group = target.comparisons.find(
                        (item) => item.id === comparison.id,
                      );
                      if (group) group.title = event.target.value;
                    }
                  })
                }
              />
              <span
                className={`tag ${!comparison.before || !comparison.after ? "tag-warning" : ""}`}
              >
                {!comparison.visible || !block.visible
                  ? "本次隐藏"
                  : !comparison.before || !comparison.after
                    ? "缺图"
                    : comparison.locked
                      ? "手动调整"
                      : "已匹配"}
              </span>
            </div>
            <div className="comparison-slots">
              {(["before", "after"] as const).map((side) => (
                <AssetSlot
                  key={side}
                  projectId={project.id}
                  assetRef={comparison[side]}
                  side={side}
                  locked={locked}
                  onPick={() =>
                    onPick({
                      blockId: block.id,
                      comparisonId: comparison.id,
                      side,
                    })
                  }
                  onDrop={(transfer) =>
                    assignDrop(transfer, {
                      blockId: block.id,
                      comparisonId: comparison.id,
                      side,
                    })
                  }
                />
              ))}
            </div>
            <div className="comparison-description-editor">
              <Field label={`对比组 ${index + 1} 说明`}>
                <textarea rows={2} maxLength={2000} value={comparison.description ?? ""} disabled={locked} placeholder="可选：这一组画面做了哪些调整？" onChange={event => onEdit(draft => {
                  const target = draft.document.blocks.find(item => item.id === block.id);
                  if (target?.type === "comparisons") {
                    const group = target.comparisons.find(item => item.id === comparison.id);
                    if (group) group.description = event.target.value;
                  }
                })} />
              </Field>
            </div>
            <div className="comparison-actions">
              <button
                className="text-button"
                disabled={locked}
                onClick={() => onComparison(block.id, comparison.id, "swap")}
              >
                <ArrowLeftRight size={14} />
                交换前后
              </button>
              <div>
                <IconButton
                  label="对比上移"
                  disabled={locked}
                  onClick={() => onComparison(block.id, comparison.id, "up")}
                >
                  <ArrowUp size={14} />
                </IconButton>
                <IconButton
                  label="对比下移"
                  disabled={locked}
                  onClick={() => onComparison(block.id, comparison.id, "down")}
                >
                  <ArrowDown size={14} />
                </IconButton>
                <IconButton
                  label={comparison.visible ? "隐藏对比" : "显示对比"}
                  disabled={locked}
                  onClick={() => onComparison(block.id, comparison.id, "hide")}
                >
                  {comparison.visible ? (
                    <Eye size={15} />
                  ) : (
                    <EyeOff size={15} />
                  )}
                </IconButton>
                <IconButton
                  label="拆开这组对比"
                  disabled={locked}
                  onClick={() => onComparison(block.id, comparison.id, "split")}
                >
                  <Scissors size={15} />
                </IconButton>
                <IconButton
                  label="删除这组关系"
                  disabled={locked}
                  onClick={() =>
                    onComparison(block.id, comparison.id, "delete")
                  }
                >
                  <Trash2 size={15} />
                </IconButton>
              </div>
            </div>
          </article>
        ))}
      </div>
      {onlyProblems && !shown.length && (
        <div className="inline-notice">
          <CheckCircle2 size={16} />
          当前没有缺图的可见对比组。
        </div>
      )}
      <div className="asset-section-heading">
        <div>
          <h3>
            文档图片库 <span>{project.assets.length}</span>
          </h3>
          <p>可以拖入对比槽位。源文件与完整视频不会被改动。</p>
        </div>
        <button
          className="text-button"
          disabled={locked}
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus size={16} />
          添加图片
        </button>
      </div>
      {project.assets.length ? (
        <div className="asset-library">
          {project.assets.map((asset) => {
            const version = asset.versions.find(
              (item) => item.id === asset.latestVersionId,
            );
            if (!version) return null;
            const oldReference = groups.some(({ comparison }) =>
              [comparison.before, comparison.after].some(
                (ref) =>
                  ref?.assetId === asset.id &&
                  ref.versionId !== asset.latestVersionId,
              ),
            );
            return (
              <div
                className="library-asset"
                key={asset.id}
                draggable={!locked}
                onDragStart={(event) =>
                  event.dataTransfer.setData(
                    "application/x-studio-asset",
                    asset.id,
                  )
                }
              >
                <img
                  src={`/api/projects/${project.id}/assets/${version.id}`}
                  alt={version.filename}
                  loading="lazy"
                />
                <div>
                  <strong title={asset.relativePath}>{version.filename}</strong>
                  <small>
                    {version.width} × {version.height} ·{" "}
                    {bytes(version.byteSize)}
                  </small>
                  {oldReference && (
                    <button
                      className="text-button"
                      disabled={locked}
                      onClick={() => {
                        if (
                          window.confirm(
                            "发现此图片的新版本。将更新本次文档中引用它的槽位，历史导出保持原样。继续？",
                          )
                        )
                          void onAccept(asset, version.id);
                      }}
                    >
                      采用已发现的新版本
                      <ArrowUpRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty icon={<ImageIcon size={26} />} title="图片会在这里汇集">
          导入文件夹，或添加几张 JPEG / PNG
          图片开始。没有对比图也能制作交付文档。
        </Empty>
      )}
      {project.excludedSourceKeys.length > 0 && (
        <details className="excluded-panel">
          <summary>
            已排除的自动配对 · {project.excludedSourceKeys.length}
          </summary>
          <p>这些关系不会在重新扫描时自动恢复。</p>
          {project.excludedSourceKeys.map((key) => (
            <div key={key}>
              <code>{key}</code>
              <button
                className="text-button"
                disabled={locked}
                onClick={() =>
                  onEdit((draft) => {
                    draft.excludedSourceKeys = draft.excludedSourceKeys.filter(
                      (item) => item !== key,
                    );
                  })
                }
              >
                允许下次重新识别
              </button>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

function AssetSlot({
  projectId,
  assetRef,
  side,
  locked,
  onPick,
  onDrop,
}: {
  projectId: string;
  assetRef: AssetRef | null;
  side: "before" | "after";
  locked: boolean;
  onPick: () => void;
  onDrop: (transfer: DataTransfer) => void;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [assetRef?.versionId]);
  return (
    <button
      className={`asset-slot ${assetRef ? "has-image" : ""}`}
      disabled={locked}
      onClick={onPick}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!locked) onDrop(event.dataTransfer);
      }}
    >
      <span className="slot-label">
        {side === "before" ? "BEFORE · 原图" : "AFTER · 调色后"}
      </span>
      {assetRef && !failed ? (
        <img
          src={`/api/projects/${projectId}/assets/${assetRef.versionId}`}
          alt={side === "before" ? "调色前图片" : "调色后图片"}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="slot-empty">
          {failed ? <AlertCircle size={24} /> : <ImagePlus size={24} />}
          <small>
            {failed ? "图片不可用，点击替换" : "点击选择或拖入图片"}
          </small>
        </span>
      )}
      <span className="slot-change">{assetRef ? "替换图片" : "选择图片"}</span>
    </button>
  );
}

function AssetPicker({
  project,
  target,
  locked,
  onClose,
  onSelect,
  onUpload,
  onDrop,
}: {
  project: ProjectRecord;
  target: SlotTarget;
  locked: boolean;
  onClose: () => void;
  onSelect: (asset: Asset) => void;
  onUpload: (files: FileList | null) => void;
  onDrop: (transfer: DataTransfer) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <Modal
      wide
      title={
        target === "logo"
          ? "选择品牌 Logo"
          : "purpose" in target
            ? target.purpose === "cover" ? "选择封面图" : "选择制作说明图"
            : `选择 ${target.side === "before" ? "Before 原图" : "After 调色后图片"}`
      }
      subtitle="从已导入的图片选择，或直接添加一张新图片。"
      onClose={onClose}
    >
      <div
        className="picker-upload"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!locked) onDrop(event.dataTransfer);
        }}
      >
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          hidden
          onChange={(event) => {
            onUpload(event.target.files);
            event.target.value = "";
          }}
        />
        <button
          className="button button-outline"
          disabled={locked}
          onClick={() => input.current?.click()}
        >
          {locked ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Upload size={17} />
          )}
          从电脑添加图片
        </button>
        <span>也可将文件拖到这里 · JPEG / PNG</span>
      </div>
      <div className="picker-grid">
        {project.assets.map((asset) => {
          const version = asset.versions.find(
            (item) => item.id === asset.latestVersionId,
          );
          if (!version) return null;
          return (
            <button
              key={asset.id}
              disabled={locked}
              onClick={() => onSelect(asset)}
            >
              <img
                src={`/api/projects/${project.id}/assets/${version.id}`}
                alt={version.filename}
                loading="lazy"
              />
              <strong>{version.filename}</strong>
              <small>
                {version.width} × {version.height}
              </small>
            </button>
          );
        })}
      </div>
      {!project.assets.length && (
        <Empty icon={<ImagePlus size={25} />} title="图片库还是空的">
          添加图片后会保留在本项目，可以随时重新选择。
        </Empty>
      )}
    </Modal>
  );
}

function ExportDialog({
  project,
  historyError,
  onRefreshHistory,
  candidate,
  busy,
  exports,
  warningsAccepted,
  setWarningsAccepted,
  onClose,
  onPrepare,
  onGenerate,
  onRetry,
  onIssue,
}: {
  project: ProjectRecord;
  historyError: string;
  onRefreshHistory: () => Promise<void>;
  candidate: PreviewCandidate | null;
  busy: string;
  exports: ExportRecord[];
  warningsAccepted: boolean;
  setWarningsAccepted: (value: boolean) => void;
  onClose: () => void;
  onPrepare: () => void;
  onGenerate: (partial: boolean) => void;
  onRetry: (id: string, target: OutputTarget) => void;
  onIssue: (issue: PreviewCandidate["issues"][number]) => void;
}) {
  const [formalTarget, setFormalTarget] = useState<OutputTarget | null>(null);
  useEffect(() => setFormalTarget(null), [candidate?.id]);
  const waiting = busy === "prepare";
  const locked = Boolean(busy);
  const usable =
    candidate?.results.filter(
      (result) => result.status === "ready" || result.status === "success",
    ) || [];
  const blocked =
    candidate?.results.some(
      (result) => result.status === "blocked" || result.status === "failed",
    ) || false;
  const warnings =
    candidate?.issues.filter((issue) => issue.severity === "warning") || [];
  const currentExports = exports.filter(
    (record) => record.candidateId === candidate?.id,
  );
  const currentDone = currentExports.some(
    (record) => record.status === "success" || record.status === "running",
  );
  return (
    <Modal
      wide
      title="让这份交付，妥善抵达"
      subtitle={`${project.title || project.projectNo} · ${labels[project.document.output.mode]}`}
      onClose={onClose}
    >
      <div className="export-content">
        {formalTarget && candidate?.previewUrls[formalTarget] && (
          <section className="formal-preview">
            <div>
              <strong>{labels[formalTarget]} · 正式预览</strong>
              <a
                href={candidate.previewUrls[formalTarget]}
                target="_blank"
                rel="noreferrer"
              >
                新窗口打开
                <ExternalLink size={12} />
              </a>
              <IconButton
                label="关闭正式预览"
                onClick={() => setFormalTarget(null)}
              >
                <X size={16} />
              </IconButton>
            </div>
            <iframe
              title={`${labels[formalTarget]}正式预览`}
              src={candidate.previewUrls[formalTarget]}
            />
          </section>
        )}
        {waiting ? (
          <div className="preparing">
            <LoaderCircle size={31} className="spin" />
            <h3>正在检查与排版</h3>
            <p>
              核对图片、文字、日期和各输出的实际版面。首次生成可能需要稍等。
            </p>
          </div>
        ) : !candidate ? (
          <Empty
            icon={<FileText size={27} />}
            title="准备正式预览"
            action={
              <button className="button" disabled={locked} onClick={onPrepare}>
                <RefreshCw size={16} />
                重新检查
              </button>
            }
          >
            当前内容需要重新检查。所有编辑成功保存后，才会生成正式版本。
          </Empty>
        ) : (
          <>
            <div className="export-meta">
              <span>
                <CheckCheck size={15} />
                已固定内容版本 R{candidate.draftRevision}
              </span>
              <span>交付日期 {candidate.resolvedDate || "不显示"}</span>
              <button
                className="text-button"
                disabled={locked}
                onClick={onPrepare}
              >
                <RefreshCw size={12} />
                重新检查
              </button>
            </div>
            <div className="target-cards">
              {candidate.results.map((result) => (
                <div
                  className={`target-card ${result.status}`}
                  key={result.target}
                >
                  <div>
                    {result.target === "pdf" ? (
                      <FileText size={24} />
                    ) : (
                      <FileImage size={24} />
                    )}
                    <strong>{labels[result.target]}</strong>
                    <span
                      className={`tag ${result.status === "blocked" || result.status === "failed" ? "tag-warning" : ""}`}
                    >
                      {result.status === "ready" || result.status === "success"
                        ? "预览就绪"
                        : result.status === "running"
                          ? "处理中"
                          : "需要处理"}
                    </span>
                  </div>
                  {result.error && <p>{result.error}</p>}
                  {candidate.previewUrls[result.target] && (
                    <button
                      className="text-button"
                      onClick={() => setFormalTarget(result.target)}
                    >
                      打开正式预览
                      <Eye size={14} />
                    </button>
                  )}
                  {result.artifacts.length > 0 && (
                    <small>
                      {result.artifacts
                        .map((artifact) =>
                          artifact.pages
                            ? `${artifact.pages} 页`
                            : artifact.width
                              ? `${artifact.width} × ${artifact.height} px`
                              : bytes(artifact.byteSize),
                        )
                        .join(" · ")}
                    </small>
                  )}
                </div>
              ))}
            </div>
            {candidate.issues.length > 0 && (
              <div className="preflight-issues">
                {candidate.issues.map((issue) => (
                  <div
                    className={`preflight-issue ${issue.severity}`}
                    key={issue.id}
                  >
                    {issue.severity === "info" ? (
                      <Circle size={15} />
                    ) : (
                      <AlertCircle size={16} />
                    )}
                    <div>
                      <strong>{issue.message}</strong>
                      <small>
                        {issue.scope === "all"
                          ? "影响共用内容"
                          : `影响${labels[issue.scope]}`}
                      </small>
                    </div>
                    {(issue.blockId || issue.assetId || issue.comparisonId) && (
                      <button
                        className="text-button"
                        onClick={() => onIssue(issue)}
                      >
                        去处理
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {warnings.length > 0 && (
              <CheckRow
                checked={warningsAccepted}
                onChange={setWarningsAccepted}
              >
                我已查看以上提醒，确认继续生成当前内容
              </CheckRow>
            )}
            <div className="export-generate">
              <p>
                {!usable.length
                  ? "当前选中目标都需要处理。修正问题后重新检查。"
                  : blocked
                    ? "可以先生成已就绪的输出，其余目标保留待处理状态。"
                    : "所选输出使用同一份内容。生成后仍可继续编辑新版本。"}
              </p>
              <button
                className="button"
                disabled={
                  locked ||
                  !usable.length ||
                  (warnings.length > 0 && !warningsAccepted) ||
                  currentDone
                }
                onClick={() => onGenerate(blocked)}
              >
                {busy === "export" ? (
                  <LoaderCircle size={16} className="spin" />
                ) : currentDone ? (
                  <Check size={16} />
                ) : (
                  <Download size={16} />
                )}
                {currentDone
                  ? "当前版本已提交"
                  : !usable.length
                    ? "请先处理问题"
                    : blocked
                      ? "先生成可用目标"
                      : "生成交付文件"}
              </button>
            </div>
          </>
        )}
        {historyError && (
          <div className="inline-notice warning">
            <AlertCircle size={16} />
            <span>导出记录刷新失败：{historyError}</span>
            <button
              className="text-button"
              onClick={() => void onRefreshHistory()}
            >
              重试刷新
            </button>
          </div>
        )}
        {exports.length > 0 && (
          <section className="export-history">
            <h3>
              导出记录 <span>{exports.length}</span>
            </h3>
            {exports.map((record) => (
              <div className="export-record" key={record.id}>
                <div className="export-record-heading">
                  <strong>
                    R{record.draftRevision}{" "}
                    <span>{dateLabel(record.createdAt)}</span>
                  </strong>
                  <span
                    className={`tag ${record.status === "partial" || record.status === "failed" ? "tag-warning" : ""}`}
                  >
                    {record.status === "success"
                      ? "已生成"
                      : record.status === "running"
                        ? "生成中"
                        : record.status === "partial"
                          ? "部分完成"
                          : "未完成"}
                  </span>
                </div>
                {record.results.map((result) => (
                  <div className="export-result" key={result.target}>
                    <span>{labels[result.target]}</span>
                    {result.status === "running" ? (
                      <span className="muted">
                        <LoaderCircle size={13} className="spin" />
                        处理中
                      </span>
                    ) : (
                      result.artifacts.map((artifact) => (
                        <a
                          key={artifact.id}
                          href={artifact.url}
                          download={artifact.filename}
                        >
                          <Download size={13} />
                          {artifact.filename}
                          <small>{bytes(artifact.byteSize)}</small>
                        </a>
                      ))
                    )}
                    {result.error && (
                      <small className="error-text">{result.error}</small>
                    )}
                    {(result.status === "failed" ||
                      result.status === "blocked") && (
                      <button
                        className="text-button"
                        disabled={locked}
                        onClick={() => onRetry(record.id, result.target)}
                      >
                        <RefreshCw size={12} />
                        重试
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}
        <p className="export-footnote">
          文件生成后由你发送给客户。“已生成”不代表已经发送或客户已阅读。
        </p>
      </div>
    </Modal>
  );
}
