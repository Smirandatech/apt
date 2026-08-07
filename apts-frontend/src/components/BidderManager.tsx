import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import api from "@/services/api";
import { toast } from "sonner";
import { Bidder, UnassignedBidder, ResumeTemplate } from "@/types/types";

export default function BidderManager() {
  const [bidders, setBidders] = useState<Bidder[]>([]);
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedBidder[]>([]);
  const [open, setOpen] = useState(false);

  const [edits, setEdits] = useState<
    Record<
      string,
      { template_id: string; drive_folder_id: string; rate: number | null }
    >
  >({});

  const fetchData = async () => {
    const [bRes, tRes] = await Promise.all([
      api.get("/developer/bidders"),
      api.get("/developer/templates"),
    ]);

    setBidders(bRes.data);
    setTemplates(tRes.data);

    const editState = Object.fromEntries(
      bRes.data.map((b: Bidder) => [
        b.id,
        {
          template_id: b.template_id || "",
          drive_folder_id: b.drive_folder_id || "",
          rate: typeof b.rate === "number" ? b.rate : null,
        },
      ])
    );
    setEdits(editState);
  };

  const fetchUnassigned = async () => {
    const res = await api.get("/developer/unassigned-bidders");
    setUnassigned(res.data);
  };

  const handleAssign = async (bidderId: string) => {
    try {
      await api.post("/developer/bidders", { bidder_id: bidderId });
      toast.success("Bidder assigned!");
      fetchData();
      setOpen(false);
    } catch {
      toast.error("Failed to assign");
    }
  };

  const handleUnassign = async (bidderId: string) => {
    try {
      await api.delete(`/developer/bidders/${bidderId}`);
      toast.success("Bidder unassigned.");
      fetchData();
    } catch {
      toast.error("Failed to unassign bidder.");
    }
  };

  const handleUpdate = async (
    bidderId: string,
    templateId: string,
    folderId: string,
    rate: number | null
  ) => {
    try {
      await api.post("/developer/bidders", {
        bidder_id: bidderId,
        template_id: templateId || null,
        drive_folder_id: folderId || null,
        rate: rate ?? null,
      });
      toast.success("Updated");
      fetchData();
    } catch {
      toast.error("Update failed");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6 flex-1">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Assigned Bidders</h2>
        <Button
          variant="outline"
          onClick={() => {
            fetchUnassigned();
            setOpen(true);
          }}
        >
          + Add Bidder
        </Button>
      </div>

      {bidders.map((bidder) => (
        <div key={bidder.id} className="p-4 border rounded space-y-3">
          <div className="flex gap-2">
            <Label htmlFor={`template-${bidder.id}`} className="min-w-30">
              Bidder :
            </Label>
            <div className="font-semibold">{bidder.username}</div>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <Label htmlFor={`template-${bidder.id}`} className="min-w-30">
                Resume Template :
              </Label>
              <Select
                value={edits[bidder.id]?.template_id || ""}
                onValueChange={(value) =>
                  setEdits((prev) => ({
                    ...prev,
                    [bidder.id]: {
                      ...prev[bidder.id],
                      template_id: value === "none" ? "" : value,
                    },
                  }))
                }
              >
                <SelectTrigger id={`template-${bidder.id}`} className="w-full">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Label htmlFor={`folder-${bidder.id}`} className="min-w-30">
                Drive Folder ID :
              </Label>
              <Input
                id={`folder-${bidder.id}`}
                placeholder="Drive Folder ID"
                value={edits[bidder.id]?.drive_folder_id || ""}
                onChange={(e) =>
                  setEdits((prev) => ({
                    ...prev,
                    [bidder.id]: {
                      ...prev[bidder.id],
                      drive_folder_id: e.target.value,
                    },
                  }))
                }
              />
            </div>

            <div className="flex gap-2">
              <Label className="min-w-30">Rate ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={
                  edits[bidder.id]?.rate === null
                    ? ""
                    : String(edits[bidder.id]?.rate)
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setEdits((prev) => ({
                    ...prev,
                    [bidder.id]: {
                      ...prev[bidder.id],
                      rate: val === "" ? null : parseFloat(val),
                    },
                  }));
                }}
              />
            </div>

            <div className="flex gap-2 mt-2">
              <Button
                onClick={() =>
                  handleUpdate(
                    bidder.id,
                    edits[bidder.id]?.template_id || "",
                    edits[bidder.id]?.drive_folder_id || "",
                    edits[bidder.id]?.rate ?? null
                  )
                }
              >
                Update
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleUnassign(bidder.id)}
              >
                Unassign
              </Button>
            </div>
          </div>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        {/* 
          Responsive modal:
          - w-[95vw] on small screens (near full-width)
          - sm:max-w-lg for desktops
          - max-h with internal scroll so the viewport never overflows
          - sticky header for context
        */}
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg p-0">
          <DialogHeader className="sticky top-0 z-10 bg-background border-b p-4">
            <DialogTitle>Assign Bidder</DialogTitle>
          </DialogHeader>

          <div className="p-4">
            <div className="max-h-[70vh] overflow-y-auto space-y-4">
              {unassigned.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No free bidders available.
                </p>
              ) : (
                unassigned.map((bidder) => (
                  <div
                    key={bidder.id}
                    className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border p-3 rounded"
                  >
                    <span className="font-medium break-words">
                      {bidder.username}
                    </span>
                    <div className="sm:min-w-28">
                      <Button
                        className="w-full sm:w-auto"
                        onClick={() => handleAssign(bidder.id)}
                      >
                        Assign
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
