import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import Layout from "@/components/layout";
// VendorsPage.tsx
// Single-file React + TypeScript page implementing CRUD for vendors.
// - Uses TailwindCSS utility classes for modern styling
// - Uses a simple, accessible modal implementation
// - Expects a REST API at /api/vendors supporting GET, POST, PUT, DELETE

export type Vendor = {
  id: number;
  name: string;
  company: string;
  contact_info: string;
  email?: string | null;
  phone?: string | null;
  created_at?: string;
};

export default function VendorsPage(): JSX.Element {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime] = useState(new Date());

  // Modal state
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  // Form state
  const [form, setForm] = useState({ name: "", company: "", contact_info: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, []);

  async function fetchVendors() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("get", "/api/vendors");
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data: Vendor[] = await res.json();
      setVendors(data);
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingVendor(null);
    setForm({ name: "", company: "", contact_info: "", email: "", phone: "" });
    setIsOpen(true);
  }

  function openEditModal(v: Vendor) {
    setEditingVendor(v);
    setForm({ name: v.name, company: v.company, contact_info: v.contact_info || "", email: v.email || "", phone: v.phone || "" });
    setIsOpen(true);
  }

  function closeModal() {
    if (submitting) return; // prevent closing while submitting
    setIsOpen(false);
    setEditingVendor(null);
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    // Basic validation
    if (!form.name.trim()) return alert("Name is required");
    setSubmitting(true);
    try {
      if (editingVendor) {
        // update
        const res = await fetch(`/api/vendors/${editingVendor.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(`Update failed: ${res.status}`);
        const updated: Vendor = await res.json();
        setVendors((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      } else {
        // create
        console.log('fetch function')
        const res = await fetch(`/api/vendors`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(`Create failed: ${res.status}`);
        const created: Vendor = await res.json();
        setVendors((prev) => [created, ...prev]);
      }
      closeModal();
    } catch (err: any) {
      alert(err.message || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  }
  console.log(vendors)

  async function handleDelete(vendor: Vendor) {
    const ok = confirm(`Delete vendor "${vendor.name}"? This can't be undone.`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      // Optimistic removal
      setVendors((prev) => prev.filter((v) => v.id !== vendor.id));
    } catch (err: any) {
      alert(err.message || "Delete failed");
    }
  }

  return (
    <Layout currentTime={currentTime}>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-4xl">
          <header className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">Vendors</h1>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              + Add vendor
            </button>
          </header>

          <div className="bg-white shadow rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-6">Loading…</div>
            ) : error ? (
              <div className="p-6 text-red-600">Error: {error}</div>
            ) : vendors.length === 0 ? (
              <div className="p-6 text-gray-500">No vendors yet. Click “Add vendor” to create one.</div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-gray-100 text-sm text-gray-600">
                  <tr>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Company</th>
                    <th className="px-6 py-3">Contact</th>
                    <th className="px-6 py-3 w-36">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr key={v.id} className="border-t">
                      <td className="px-6 py-4 align-top">{v.name}</td>
                      <td className="px-6 py-4 align-top">{v.company}</td>
                      <td className="px-6 py-4 align-top">{v.contact_info}</td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(v)}
                            className="rounded px-3 py-1 text-sm border hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(v)}
                            className="rounded px-3 py-1 text-sm border text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Modal (Add / Edit) */}
          {isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => {
                  if (!submitting) closeModal();
                }}
              />

              <form
                onSubmit={handleSubmit}
                className="relative z-10 w-full max-w-lg rounded-lg bg-white p-6 shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-medium">
                    {editingVendor ? "Edit vendor" : "Add vendor"}
                  </h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-4 grid gap-4">
                  <label className="block">
                    <div className="text-sm text-gray-600">Name</div>
                    <input
                      name="name"
                      value={form.name}
                      onChange={onChange}
                      className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="Vendor name"
                      required
                    />
                  </label>

                  <label className="block">
                    <div className="text-sm text-gray-600">Company</div>
                    <input
                      name="company"
                      value={form.company}
                      onChange={onChange}
                      className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="Vendor company"
                    />
                  </label>

                  <label className="block">
                    <div className="text-sm text-gray-600">Contact info</div>
                    <textarea
                      name="contact_info"
                      value={form.contact_info}
                      onChange={onChange}
                      className="mt-1 w-full rounded border px-3 py-2 h-24 resize-y focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="Phone, email, notes..."
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <div className="text-sm text-gray-600">Email</div>
                      <input
                        name="email"
                        value={form.email}
                        onChange={onChange}
                        type="email"
                        className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        placeholder="vendor@example.com"
                      />
                    </label>
                    <label className="block">
                      <div className="text-sm text-gray-600">Phone</div>
                      <input
                        name="phone"
                        value={form.phone}
                        onChange={onChange}
                        className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        placeholder="(555) 123-4567"
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={submitting}
                    className="rounded px-4 py-2 border hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {submitting ? (editingVendor ? "Saving…" : "Creating…") : editingVendor ? "Save" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
