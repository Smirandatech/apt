import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import api from "@/services/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ApiKeySettings() {
  const [apiKey, setApiKey] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [preferredModel, setPreferredModel] = useState("gpt-4o");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/developer/settings").then((res) => {
      setApiKey(res.data.openai_api_key || "");
      setDeepseekKey(res.data.deepseek_api_key || "");
      setPreferredModel(res.data.preferred_ai_model || "gpt-4o");
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch("/developer/settings", {
        openai_api_key: apiKey,
        deepseek_api_key: deepseekKey,
        preferred_ai_model: preferredModel,
      });
      toast.success("Settings saved!");
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>AI Model & API Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="model">Preferred AI Model</Label>
          <Select value={preferredModel} onValueChange={setPreferredModel}>
            <SelectTrigger id="model">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
              <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
              <SelectItem value="deepseek">DeepSeek</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="apiKey">OpenAI API Key</Label>
          <Input
            id="apiKey"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="deepseekKey">DeepSeek API Key</Label>
          <Input
            id="deepseekKey"
            placeholder="ds-..."
            value={deepseekKey}
            onChange={(e) => setDeepseekKey(e.target.value)}
          />
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
