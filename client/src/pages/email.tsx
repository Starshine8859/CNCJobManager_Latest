import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type EmailRow = {
  id: number;
  folder: string;
  from: string;
  to: string;
  cc?: string | null;
  bcc?: string | null;
  subject?: string | null;
  body?: string | null;
  status?: string | null;
  createdAt: string;
};

export default function EmailCenterPage() {
  const [currentTime] = useState(new Date());
  const [folder, setFolder] = useState<string>("sent");
  const [search, setSearch] = useState("");
  const [compose, setCompose] = useState({ to: "", cc: "", bcc: "", subject: "", body: "", status: "sent" as 'sent'|'draft'|'scheduled', scheduledAt: "" });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: emails = [], isLoading } = useQuery<EmailRow[]>({
    queryKey: ["emails", folder, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("folder", folder);
      if (search) params.set("q", search);
      const res = await apiRequest("GET", `/api/emails?${params.toString()}`);
      return res.json();
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { ...compose };
      if (compose.status !== 'scheduled') delete payload.scheduledAt;
      const res = await apiRequest("POST", "/api/emails", payload);
      return res.json();
    },
    onSuccess: (saved: any) => {
      const isDraft = saved?.status === 'draft' || saved?.folder === 'drafts';
      toast({ title: isDraft ? "Draft saved" : compose.status === 'scheduled' ? 'Scheduled' : 'Sent', description: isDraft ? "Email saved to drafts." : compose.status === 'scheduled' ? 'Email scheduled.' : 'Email sent.' });
      setCompose({ to: "", cc: "", bcc: "", subject: "", body: "", status: 'sent', scheduledAt: "" });
      queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to save email", variant: "destructive" }),
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, folder }: { id: number; folder: string }) => {
      const res = await apiRequest("PUT", `/api/emails/${id}`, { folder });
      if (!res.ok) throw new Error("Failed to move email");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["emails"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/emails/${id}`);
      if (!res.ok) throw new Error("Failed to delete email");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["emails"] }),
  });

  return (
    <Layout currentTime={currentTime}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Email</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Compose</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="To" value={compose.to} onChange={(e) => setCompose({ ...compose, to: e.target.value })} />
              <Input placeholder="CC" value={compose.cc} onChange={(e) => setCompose({ ...compose, cc: e.target.value })} />
              <Input placeholder="BCC" value={compose.bcc} onChange={(e) => setCompose({ ...compose, bcc: e.target.value })} />
              <Input placeholder="Subject" value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} />
              <Textarea placeholder="Message" value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} />
              <div className="flex items-center gap-2">
                <Select value={compose.status} onValueChange={(v) => setCompose({ ...compose, status: v as any })}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sent">Send Now</SelectItem>
                    <SelectItem value="draft">Save Draft</SelectItem>
                    <SelectItem value="scheduled">Schedule</SelectItem>
                  </SelectContent>
                </Select>
                {compose.status === 'scheduled' && (
                  <Input type="datetime-local" value={compose.scheduledAt} onChange={(e) => setCompose({ ...compose, scheduledAt: e.target.value })} />
                )}
              </div>
              <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending || (compose.status !== 'draft' && !compose.to)}>
                {compose.status === 'draft' ? 'Save draft' : compose.status === 'scheduled' ? 'Schedule' : 'Send'}
              </Button>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Mailbox</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-3">
                <Select value={folder} onValueChange={setFolder}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Folder" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inbox">Inbox</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="drafts">Drafts</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="spam">Spam</SelectItem>
                    <SelectItem value="trash">Trash</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Search subject/from/to" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">From</th>
                      <th className="py-2 pr-3">To</th>
                      <th className="py-2 pr-3">Subject</th>
                      <th className="py-2 pr-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan={5} className="py-6 text-center text-gray-500">Loading...</td></tr>
                    ) : emails.length === 0 ? (
                      <tr><td colSpan={5} className="py-6 text-center text-gray-500">No emails</td></tr>
                    ) : (
                      emails.map((e) => (
                        <tr key={e.id} className="border-t">
                          <td className="py-2 pr-3 whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</td>
                          <td className="py-2 pr-3">{e.from}</td>
                          <td className="py-2 pr-3">{e.to}</td>
                          <td className="py-2 pr-3">{e.subject || ''}</td>
                          <td className="py-2 pr-3 text-right space-x-2">
                            {folder !== 'spam' && (
                              <Button variant="outline" size="sm" onClick={() => moveMutation.mutate({ id: e.id, folder: 'spam' })}>Spam</Button>
                            )}
                            {folder !== 'trash' && (
                              <Button variant="outline" size="sm" onClick={() => moveMutation.mutate({ id: e.id, folder: 'trash' })}>Trash</Button>
                            )}
                            <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(e.id)}>Delete</Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}


