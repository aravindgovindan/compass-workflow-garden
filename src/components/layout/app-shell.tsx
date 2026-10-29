import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  BookOpen,
  AlertTriangle,
  Flag,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Settings,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { CurrentUser } from "@/functions/session.functions";
import { canAccessSection, type Section } from "@/lib/auth/roles";
import type { TermKey } from "@/lib/terminology/defaults";
import { useTerm } from "@/lib/terminology/use-term";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Logo } from "@/components/brand/logo";
import { HealthBadge } from "@/components/common/health-badge";
import { UatBanner } from "@/components/uat/uat-banner";
import { ProjectSwitcher } from "@/components/layout/project-switcher";
import { PagePending } from "@/components/common/route-states";

type NavItem = { section: Section; term: TermKey; to: string; icon: LucideIcon };

const work: NavItem[] = [
  { section: "dashboard", term: "dashboard", to: "/dashboard", icon: LayoutDashboard },
  { section: "tasks", term: "task", to: "/tasks", icon: ListTodo },
  { section: "milestones", term: "milestone", to: "/milestones", icon: Flag },
  { section: "risks", term: "risk", to: "/risks", icon: ShieldAlert },
  { section: "issues", term: "issue", to: "/issues", icon: AlertTriangle },
];
const people: NavItem[] = [
  { section: "team", term: "team", to: "/team", icon: Users },
  { section: "activity", term: "activity", to: "/activity", icon: Activity },
  { section: "settings", term: "settings", to: "/settings", icon: Settings },
];

const roleLabel = { owner: "Owner", member: "Member", stakeholder: "Stakeholder" } as const;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

export function AppShell({ me, children }: { me: CurrentUser; children: ReactNode }) {
  const [switching, setSwitching] = useState(false);
  const role = me.membership?.role ?? null;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const term = useTerm();
  const name = me.profile?.full_name || me.profile?.email || "You";

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const renderGroup = (label: string, items: NavItem[]) => {
    const visible = items.filter((i) => canAccessSection(role, i.section));
    if (!visible.length) return null;
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-sidebar-foreground/50">{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {visible.map((i) => {
              const active = pathname === i.to || pathname.startsWith(i.to + "/");
              return (
                <SidebarMenuItem key={i.to}>
                  <SidebarMenuButton asChild isActive={active} tooltip={term(i.term)}>
                    <Link to={i.to}>
                      <i.icon aria-hidden />
                      <span>{term(i.term)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <SidebarProvider>
      <CloseMobileOnNavigate pathname={pathname} />
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-3 py-4">
          <Link to="/dashboard" aria-label="Compass Workflow home" className="group-data-[collapsible=icon]:hidden">
            <Logo inverted />
          </Link>
          <div className="mt-4 group-data-[collapsible=icon]:hidden"><ProjectSwitcher me={me} busy={switching} onBusy={setSwitching} /></div>
        </SidebarHeader>
        <SidebarContent>
          {renderGroup("Work", work)}
          {renderGroup("Project", people)}
          <SidebarGroup><SidebarGroupContent><SidebarMenu><SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/guide"} tooltip="User guide">
              <Link to="/guide" search={{ role: role ?? "owner" }}><BookOpen aria-hidden /><span>User guide</span></Link>
            </SidebarMenuButton>
          </SidebarMenuItem></SidebarMenu></SidebarGroupContent></SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-3 text-xs text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
          Compass Workflow
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 overflow-x-clip">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur">
          <SidebarTrigger aria-label="Toggle navigation" />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {me.membership ? (
              <>
                <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-secondary-foreground">
                  {me.membership.project.code}
                </span>
                <span className="truncate text-sm font-medium">{me.membership.project.name}</span>
                <HealthBadge value={me.membership.project.health} className="hidden sm:inline-flex" />
              </>
            ) : (
              <span className="text-sm text-muted-foreground">No project yet</span>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
              <Avatar className="size-8">
                {me.profile?.avatar_url && <AvatarImage src={me.profile.avatar_url} alt="" />}
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials(name)}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="truncate text-sm">{name}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">
                  {role ? roleLabel[role] : "No role yet"}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut}>
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <UatBanner me={me} />
        <main key={me.membership?.project.id} className="mx-auto min-w-0 w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{switching ? <PagePending /> : children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

/** Closes the mobile sidebar drawer whenever the route changes so it never blocks the new page. */
function CloseMobileOnNavigate({ pathname }: { pathname: string }) {
  const { setOpenMobile } = useSidebar();
  useEffect(() => {
    setOpenMobile(false);
    if (document.body.style.pointerEvents === "none") document.body.style.pointerEvents = "";
  }, [pathname, setOpenMobile]);
  return null;
}
