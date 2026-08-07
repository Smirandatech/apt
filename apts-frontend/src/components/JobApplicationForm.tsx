import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import api from "@/services/api";
import { Download } from "lucide-react";

interface Props {
  onSuccess: () => void;
  onClose?: () => void;
}

export default function JobApplicationForm({ onSuccess, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeUrl, setResumeUrl] = useState("https://");
  const [note, setNote] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return toast.warning("Job title is required.");
    if (!company.trim()) return toast.warning("Company name is required.");
    if (!jobUrl.trim()) return toast.warning("Job URL is required.");
    if (!jobDescription.trim()) return toast.warning("Job description is required.");
    if (!resumeUrl.trim()) return toast.warning("Resume URL is required.");

    const min = Number(salaryMin);
    const max = Number(salaryMax);
    if (min && max && min > max) {
      toast.warning("Salary Min should be less than or equal to Max.");
      return;
    }

    const metadata = {
      note,
      salary_range: {
        min: min || undefined,
        max: max || undefined,
      },
    };

    try {
      setLoading(true);
      await api.post("/applications", {
        title,
        company_name: company,
        job_description_url: jobUrl,
        job_description: jobDescription,
        resume_url: resumeUrl,
        metadata,
      });
      toast.success("Application submitted!");
      onSuccess();
      onClose?.();
    } catch {
      toast.error("Submission failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateResume = async () => {
    if (!jobDescription || !company) {
      toast.warning("Please paste the Job Description and Company first.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/resume/generate", {
        jobDescription,
        companyName: company,
      });

      const { file, mimeType  } = res.data;

      const blob = new Blob([Uint8Array.from(atob(file), c => c.charCodeAt(0))], {
        type: mimeType,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = company;
      link.click();
      link.remove();

      // setResumeUrl(driveUrl);
      toast.success("Resume generated and downloaded!");
      // setTitle(parsed.roleTitle);
      // setCompany(parsed.companyName);
      
    } catch (err: any) {
      if (err?.response?.data?.clearance) toast.error("This is a Security Clearance Job!");
      else toast.error("Failed to generate resume.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Wrapper keeps content within viewport height and enables internal scrolling on small screens
    <div className="relative max-h-[85dvh] md:max-h-[80dvh] overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="
          grid gap-4
          p-4 sm:p-6
          md:grid-cols-2
        "
      >
        {/* Full-width fields */}
        <div className="md:col-span-1">
          <Label>Job Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoComplete="job-title"
            required
          />
        </div>

        <div className="md:col-span-1">
          <Label>Company</Label>
          <Input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoComplete="organization"
            required
          />
        </div>

        <div className="md:col-span-2">
          <Label>Job URL</Label>
          <Input
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            inputMode="url"
            autoComplete="url"
            required
          />
        </div>

        <div className="md:col-span-2">
          <Label>Job Description</Label>
          <Textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={5}
            className="resize-y max-h-60 md:max-h-72"
            required
          />
        </div>

        {/* Resume row: stacks on small screens, flex row on md+ */}
        <div className="md:col-span-2">
          <Label>Resume URL</Label>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Input
              value={resumeUrl}
              onChange={(e) => setResumeUrl(e.target.value)}
              className="md:flex-1 min-w-0"
              required
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateResume}
              disabled={loading}
              className="whitespace-nowrap"
            >
              {loading ? (
                "Generating..."
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="md:col-span-2">
          <Label>Note</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="resize-y max-h-40"
          />
        </div>

        {/* Two columns only when there’s room */}
        <div className="md:col-span-1">
          <Label>Salary Min</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={salaryMin}
            onChange={(e) => setSalaryMin(e.target.value)}
          />
        </div>
        <div className="md:col-span-1">
          <Label>Salary Max</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={salaryMax}
            onChange={(e) => setSalaryMax(e.target.value)}
          />
        </div>

        {/* Sticky submit for mobile so the button is always reachable */}
        <div className="md:col-span-2 sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
          <Button type="submit" className="w-full" disabled={loading}>
            Submit
          </Button>
        </div>
      </form>
    </div>
  );
}
