import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Download, User } from "lucide-react";
import { toast } from "sonner";
import api from "@/services/api";
import { ResumeTemplate } from "@/types/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  template: ResumeTemplate;
  onRefresh: () => void;
}

function extractDriveFileId(url: string): string | null {
  const match = url.match(/\/file\/d\/([^/]+)/);
  return match ? match[1] : null;
}

export default function ResumeTemplateItem({ template, onRefresh }: Props) {
  const [newName, setNewName] = useState(template.name);
  const [companyCount, setCompanyCount] = useState(template.company_count ?? 0);
  const [prompt, setPrompt] = useState(template.prompt ?? "");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [demographicsOpen, setDemographicsOpen] = useState(false);

  const [demographics, setDemographics] = useState<any>({
    ...(template.demographics ?? {}),
  });

  const handleSave = async () => {
    if (!newName || !companyCount || !prompt) {
      toast.warning("Please check input fields.");
      return;
    }

    try {
      setSaving(true);
      const formData = new FormData();
      formData.append("name", newName);
      formData.append("company_count", String(companyCount));
      formData.append("prompt", prompt);
      if (newFile) formData.append("file", newFile);
      await api.patch(`/developer/templates/${template.id}`, formData, {
        headers: {
          "Content-Type" : "mutlipart/form-data"
        }
      });
      toast.success("Template updated.");
      onRefresh();
    } catch {
      toast.error("Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDemographicsSave = async () => {
    try {
      await api.patch(`/developer/templates/${template.id}`, {
        demographics,
      });
      toast.success("Demographics saved.");
      setDemographicsOpen(false);
      onRefresh();
    } catch {
      toast.error("Failed to save demographics.");
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/developer/templates/${template.id}`);
      toast.success("Template deleted.");
      onRefresh();
    } catch {
      toast.error("Delete failed.");
    } finally {
      setConfirmOpen(false);
    }
  };

  const hasChanges =
    newName !== template.name ||
    companyCount !== (template.company_count ?? 0) ||
    prompt !== (template.prompt ?? "") ||
    newFile;

  const driveId = extractDriveFileId(template.file_url);
  const downloadUrl = driveId
    ? `https://drive.google.com/uc?export=download&id=${driveId}`
    : template.file_url;

  return (
    <>
      <li
        className={`px-4 py-2 border rounded ${
          !hasChanges ? "bg-muted" : ""
        } flex items-center justify-between gap-4`}
      >
        <div className="flex-1 space-y-2">
          <div>
            <Label htmlFor={`name-${template.id}`} className="text-sm">
              Template Name
            </Label>
            <Input
              id={`name-${template.id}`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="text-sm"
            />
          </div>

          <div>
            <Label htmlFor={`company-${template.id}`} className="text-sm">
              Companies in Career
            </Label>
            <Input
              id={`company-${template.id}`}
              type="number"
              min={2}
              max={6}
              value={companyCount}
              onChange={(e) => setCompanyCount(Number(e.target.value))}
              className="text-sm"
            />
          </div>

          <div>
            <Label htmlFor={`prompt-${template.id}`} className="text-sm">
              Prompt
            </Label>
            <Textarea
              id={`prompt-${template.id}`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="text-sm max-h-40"
            />
          </div>

          <div>
            <Label htmlFor={`file-${template.id}`}>Upload New File</Label>
            <Input
              id={`file-${template.id}`}
              type="file"
              accept=".docx"
              onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Uploaded {new Date(template.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex flex-col gap-2 items-center">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? "Saving..." : "Save"}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => setDemographicsOpen(true)}
            title="Edit Demographics"
          >
            <User className="h-4 w-4 text-blue-600" />
          </Button>

          <a href={downloadUrl} rel="noopener noreferrer" title="Download">
            <Button size="icon" variant="ghost">
              <Download className="h-4 w-4" />
            </Button>
          </a>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </li>

      {/* Confirm Delete Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <b>{template.name}</b>?
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Demographics Dialog */}
      <Dialog open={demographicsOpen} onOpenChange={setDemographicsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Demographics</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={demographics.name ?? ""}
                onChange={(e) =>
                  setDemographics((d: any) => ({ ...d, name: e.target.value }))
                }
              />
            </div>

            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={demographics.email ?? ""}
                onChange={(e) =>
                  setDemographics((d: any) => ({ ...d, email: e.target.value }))
                }
              />
            </div>

            <div>
              <Label>Gender</Label>
              <Select
                value={demographics.gender ?? ""}
                onValueChange={(value) =>
                  setDemographics((d: any) => ({ ...d, gender: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Non-binary">Non-binary</SelectItem>
                  <SelectItem value="Prefer not to say">
                    Prefer not to say
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Date of Birth</Label>
              <Input
                type="date"
                value={demographics.dob ?? ""}
                onChange={(e) =>
                  setDemographics((d: any) => ({ ...d, dob: e.target.value }))
                }
              />
            </div>

            <div>
              <Label>Ethnicity</Label>
              <Select
                value={demographics.ethnicity ?? ""}
                onValueChange={(value) =>
                  setDemographics((d: any) => ({ ...d, ethnicity: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select ethnicity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asian">Asian</SelectItem>
                  <SelectItem value="Black">Black</SelectItem>
                  <SelectItem value="Hispanic">Hispanic</SelectItem>
                  <SelectItem value="White">White</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                  <SelectItem value="Prefer not to say">
                    Prefer not to say
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Disability Status</Label>
              <Select
                value={demographics.disability ?? ""}
                onValueChange={(value) =>
                  setDemographics((d: any) => ({ ...d, disability: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                  <SelectItem value="Prefer not to say">
                    Prefer not to say
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Veteran Status</Label>
              <Select
                value={demographics.veteran ?? ""}
                onValueChange={(value) =>
                  setDemographics((d: any) => ({ ...d, veteran: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                  <SelectItem value="Prefer not to say">
                    Prefer not to say
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Phone</Label>
              <Input
                value={demographics.phone ?? ""}
                onChange={(e) =>
                  setDemographics((d: any) => ({ ...d, phone: e.target.value }))
                }
              />
            </div>

            <div className="col-span-2">
              <Label>Address</Label>
              <Input
                value={demographics.address ?? ""}
                onChange={(e) =>
                  setDemographics((d: any) => ({
                    ...d,
                    address: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>LinkedIn</Label>
              <Input
                type="url"
                value={demographics.linkedin ?? ""}
                onChange={(e) =>
                  setDemographics((d: any) => ({
                    ...d,
                    linkedin: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>Website/Portfolio</Label>
              <Input
                type="url"
                value={demographics.website ?? ""}
                onChange={(e) =>
                  setDemographics((d: any) => ({
                    ...d,
                    website: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDemographicsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDemographicsSave}>Save Demographics</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
