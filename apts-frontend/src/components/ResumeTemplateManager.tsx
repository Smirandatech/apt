import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResumeTemplate } from "@/types/types";
import api from "@/services/api";
import { toast } from "sonner";
import ResumeTemplateItem from "@/components/ResumeTemplateItem";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ResumeTemplateManager() {
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [companyCount, setCompanyCount] = useState<number>(0);
  const [prompt, setPrompt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false); // 👈 Modal open state

  const fetchTemplates = async () => {
    try {
      const res = await api.get("/developer/templates");
      setTemplates(res.data);
    } catch {
      toast.error("Failed to fetch templates.");
    }
  };

  const handleUpload = async () => {
    if (!file || !name || !prompt || !companyCount) {
      toast.warning("Please check input fields.");
      return;
    }

    try {
      setUploading(true);
      const form = new FormData();
      form.append("file", file);
      form.append("name", name);
      form.append("company_count", companyCount.toString());
      form.append("prompt", prompt);
      await api.post("/developer/templates", form);
      toast.success("Template uploaded!");
      setFile(null);
      setName("");
      setCompanyCount(0);
      setPrompt("");
      setOpen(false); // 👈 close modal
      (document.getElementById("file") as HTMLInputElement).value = "";
      fetchTemplates();
    } catch {
      toast.error("Failed to upload template.");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  return (
    <div className="space-y-6 flex-1">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Resume Templates</h2>
        <Button variant="outline" onClick={() => setOpen(true)}>
          + Add Template
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Resume Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="file">Select .docx file</Label>
              <Input
                id="file"
                type="file"
                accept=".docx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                placeholder="e.g. Developer Template"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="company_count">Companies in Career</Label>
              <Input
                id="company_count"
                type="number"
                min={2}
                max={6}
                value={companyCount}
                onChange={(e) => setCompanyCount(Number(e.target.value))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                placeholder="e.g. The Resume Prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="max-h-40"
              />
            </div>

            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? "Uploading..." : "Upload Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div>
        <ul className="space-y-2">
          {templates.map((tpl) => (
            <ResumeTemplateItem
              key={tpl.id}
              template={tpl}
              onRefresh={fetchTemplates}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
