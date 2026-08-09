"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, ShieldCheck, Users, Search, RefreshCw, UserX, KeyRound, X, Check, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";

type ApiUser = {
  id: number;
  username: string;
  name: string;
  email: string | null;
  role_id: number | null;
  role_name: string | null;
  is_active: boolean | number;
  last_login_at: string | null;
};

type ApiRole = {
  id: number;
  name: string;
  description?: string | null;
};

type UserAccount = {
  id: number;
  nama: string;
  username: string;
  role: string;
  roleId: number | null;
  email?: string | null;
  status: "AKTIF" | "NONAKTIF";
  lastLogin?: string;
};

const getDashboardTarget = (roleName?: string | null) =>
  String(roleName || "").toLowerCase() === "staff_pramuniaga" ? "/admin/dashboard-pramuniaga" : "/admin/dashboard";

const roleBadge = (role: string) => {
  const key = role.toLowerCase();
  if (key.includes("owner")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (key.includes("admin")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (key.includes("kasir")) return "bg-sky-50 text-sky-700 border-sky-200";
  if (key.includes("gudang")) return "bg-violet-50 text-violet-700 border-violet-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
};

const statusBadge = (status: UserAccount["status"]) =>
  status === "AKTIF" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200";

const formatLastLogin = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID");
};

export default function MasterUsersPage() {
  const router = useRouter();
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [items, setItems] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | UserAccount["status"]>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [editRoleUser, setEditRoleUser] = useState<UserAccount | null>(null);
  const [editRoleValue, setEditRoleValue] = useState<string>("");
  const [editRoleSaving, setEditRoleSaving] = useState(false);
  const [editRoleError, setEditRoleError] = useState<string | null>(null);
  const [syncingUserId, setSyncingUserId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    username: "",
    email: "",
    role_id: "",
    password: "",
    is_active: true,
  });

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
    if (!raw) {
      router.replace("/admin/login");
      return;
    }
    try {
      const data = JSON.parse(raw);
      const roleName = String(data?.role?.name || "").toLowerCase();
      const isSuperAdmin = roleName === "super_admin";
      const isItSupport = roleName === "it_support";
      if (!isSuperAdmin && !isItSupport) {
        router.replace(getDashboardTarget(data?.role?.name));
      }
    } catch {
      router.replace("/admin/login");
    }
  }, [router]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/users`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ApiUser[] = await res.json();
      const mapped = (Array.isArray(data) ? data : []).map((u) => ({
        id: u.id,
        nama: u.name || u.username,
        username: u.username,
        role: u.role_name || "User",
        roleId: u.role_id ?? null,
        email: u.email,
        status: (u.is_active ? "AKTIF" : "NONAKTIF") as UserAccount["status"],
        lastLogin: formatLastLogin(u.last_login_at),
      }));
      setItems(mapped);
    } catch (err) {
      console.error("Failed fetch users", err);
      setError("Gagal memuat akun");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    setRoleError(null);
    try {
      const res = await fetch(`${API_BASE}/users/roles`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ApiRole[] = await res.json();
      setRoles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed fetch roles", err);
      setRoleError("Gagal memuat role");
      setRoles([]);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const roleOptions = useMemo(() => {
    const set = new Set(items.map((i) => i.role).filter(Boolean));
    return Array.from(set.values());
  }, [items]);

  const filtered = useMemo(() => {
    const keyword = query.toLowerCase();
    return items.filter((u) => {
      const matchText =
        u.nama.toLowerCase().includes(keyword) ||
        u.username.toLowerCase().includes(keyword) ||
        u.role.toLowerCase().includes(keyword);
      const matchRole = roleFilter === "ALL" || u.role === roleFilter;
      const matchStatus = statusFilter === "ALL" || u.status === statusFilter;
      return matchText && matchRole && matchStatus;
    });
  }, [items, query, roleFilter, statusFilter]);

  const resolveRoleId = (user: UserAccount) => {
    if (user.roleId) return String(user.roleId);
    const match = roles.find((role) => role.name === user.role);
    return match ? String(match.id) : "";
  };

  const openEditRole = (user: UserAccount) => {
    setEditRoleError(null);
    setEditRoleUser(user);
    setEditRoleValue(resolveRoleId(user));
    setEditRoleOpen(true);
  };

  const toggleStatus = async (user: UserAccount) => {
    const nextStatus = user.status === "AKTIF" ? "NONAKTIF" : "AKTIF";
    try {
      const res = await fetch(`${API_BASE}/users/${user.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextStatus === "AKTIF" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)));
    } catch (err) {
      console.error("Failed update status", err);
      window.alert("Gagal mengubah status user.");
    }
  };

  const resetPassword = async (user: UserAccount) => {
    const newPassword = window.prompt(`Reset password untuk ${user.nama} (${user.username}).\nMasukkan password baru:`);
    if (!newPassword) return;
    try {
      const res = await fetch(`${API_BASE}/users/${user.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      window.alert("Password berhasil direset.");
    } catch (err) {
      console.error("Failed reset password", err);
      window.alert("Gagal reset password.");
    }
  };

  const syncToKasir = async (user: UserAccount) => {
    setSyncingUserId(user.id);
    try {
      const res = await fetch(`${API_BASE}/users/${user.id}/sync-to-kasir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 207) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      const results = Array.isArray(data?.results) ? data.results : [];
      const successCount = results.filter((row: any) => row?.ok).length;
      const failCount = results.length - successCount;
      const lines = results.map((row: any) =>
        row?.ok
          ? `${row.server} (${row.database}): OK`
          : `${row.server} (${row.database}): ${row.error || "Gagal"}`
      );

      window.alert(
        [
          `Sync user ${user.username} selesai.`,
          `Berhasil: ${successCount}`,
          `Gagal: ${failCount}`,
          "",
          ...lines,
        ].join("\n")
      );
    } catch (err) {
      console.error("Failed sync user to kasir", err);
      window.alert("Gagal sync user ke kasir.");
    } finally {
      setSyncingUserId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Master Users</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setCreateForm({
              name: "",
              username: "",
              email: "",
              role_id: roles[0]?.id ? String(roles[0].id) : "",
              password: "",
              is_active: true,
            });
            setCreateOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          Tambah Akun
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_0.6fr_0.6fr_auto]">
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, username, atau role"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="ALL">Semua Role</option>
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="ALL">Semua Status</option>
          <option value="AKTIF">Aktif</option>
          <option value="NONAKTIF">Nonaktif</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setRoleFilter("ALL");
            setStatusFilter("ALL");
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Reset
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Daftar Akun</p>
              <p className="text-base font-semibold text-gray-800">Total {filtered.length} akun</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
            <ShieldCheck className="w-4 h-4" />
            Data users
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Login Terakhir</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Memuat data akun...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-rose-600">
                    {error}
                  </td>
                </tr>
              )}
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{user.nama}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{user.username}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${roleBadge(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{user.email || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${statusBadge(user.status)}`}>
                      {user.status === "AKTIF" ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{user.lastLogin || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditRole(user)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        <UserCog className="w-4 h-4" />
                        Edit Role
                      </button>
                      <button
                        type="button"
                        onClick={() => resetPassword(user)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        <KeyRound className="w-4 h-4" />
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => syncToKasir(user)}
                        disabled={syncingUserId === user.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncingUserId === user.id ? "animate-spin" : ""}`} />
                        {syncingUserId === user.id ? "Sync..." : "Sync to Kasir"}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStatus(user)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        <UserX className="w-4 h-4" />
                        {user.status === "AKTIF" ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Tidak ada akun yang sesuai filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !creating && setCreateOpen(false)} />
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tambah Akun</p>
                <h3 className="text-lg font-bold text-gray-900">Buat user baru</h3>
              </div>
              <button
                onClick={() => !creating && setCreateOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Tutup"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {createError && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{createError}</div>}
            {roleError && <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{roleError}</div>}

            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-gray-600 text-xs">Nama</span>
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-2"
                />
              </label>
              <label className="space-y-1">
                <span className="text-gray-600 text-xs">Username</span>
                <input
                  value={createForm.username}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, username: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-2"
                />
              </label>
              <label className="space-y-1">
                <span className="text-gray-600 text-xs">Email</span>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-2"
                />
              </label>
              <label className="space-y-1">
                <span className="text-gray-600 text-xs">Role</span>
                <select
                  value={createForm.role_id}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, role_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-2"
                >
                  <option value="">Pilih role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={String(role.id)}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-gray-600 text-xs">Password</span>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-2"
                />
              </label>
              <label className="flex items-center gap-2 md:col-span-2">
                <input
                  type="checkbox"
                  checked={createForm.is_active}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-600">Aktifkan akun</span>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50"
                disabled={creating}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!createForm.name || !createForm.username || !createForm.password || !createForm.role_id) {
                    setCreateError("Nama, username, password, dan role wajib diisi.");
                    return;
                  }
                  setCreateError(null);
                  setCreating(true);
                  try {
                    const res = await fetch(`${API_BASE}/users`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: createForm.name,
                        username: createForm.username,
                        email: createForm.email || null,
                        role_id: Number(createForm.role_id),
                        password: createForm.password,
                        is_active: createForm.is_active,
                      }),
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error(data.message || `HTTP ${res.status}`);
                    }
                    setCreateOpen(false);
                    await fetchUsers();
                  } catch (err) {
                    console.error("Failed create user", err);
                    setCreateError("Gagal menambah user. Periksa username/email.");
                  } finally {
                    setCreating(false);
                  }
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60"
                disabled={creating}
              >
                <span className="inline-flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Simpan
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {editRoleOpen && editRoleUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !editRoleSaving && setEditRoleOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Edit Role</p>
                <h3 className="text-lg font-bold text-gray-900">Ubah role untuk {editRoleUser.nama}</h3>
              </div>
              <button
                onClick={() => !editRoleSaving && setEditRoleOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Tutup"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {editRoleError && (
              <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                {editRoleError}
              </div>
            )}

            <label className="space-y-1 text-sm">
              <span className="text-gray-600 text-xs">Role</span>
              <select
                value={editRoleValue}
                onChange={(e) => setEditRoleValue(e.target.value)}
                className="w-full border border-gray-200 rounded px-2 py-2"
              >
                <option value="">Pilih role</option>
                {roles.map((role) => (
                  <option key={role.id} value={String(role.id)}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditRoleOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50"
                disabled={editRoleSaving}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!editRoleValue) {
                    setEditRoleError("Role wajib dipilih.");
                    return;
                  }
                  setEditRoleError(null);
                  setEditRoleSaving(true);
                  try {
                    const res = await fetch(`${API_BASE}/users/${editRoleUser.id}/role`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ role_id: Number(editRoleValue) }),
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error(data.message || `HTTP ${res.status}`);
                    }
                    const nextRole = roles.find((role) => String(role.id) === editRoleValue);
                    setItems((prev) =>
                      prev.map((row) =>
                        row.id === editRoleUser.id
                          ? { ...row, role: nextRole?.name || row.role, roleId: Number(editRoleValue) }
                          : row
                      )
                    );
                    setEditRoleOpen(false);
                  } catch (err) {
                    console.error("Failed update role", err);
                    setEditRoleError("Gagal mengubah role user.");
                  } finally {
                    setEditRoleSaving(false);
                  }
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60"
                disabled={editRoleSaving}
              >
                <span className="inline-flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Update Role
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
