"use client";

import { Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { PasswordStrategy } from "@/lib/validations/student";
import { generatePatternPassword } from "@/lib/utils/password-generator";

type PasswordGeneratorProps = {
  passwordStrategy: PasswordStrategy;
  forcePasswordChange: boolean;
  onPasswordStrategyChange: (value: PasswordStrategy) => void;
  onForcePasswordChangeChange: (value: boolean) => void;
  branch?: string;
  enrollmentNo?: string;
  mobile?: string;
  showPreview?: boolean;
};

export function PasswordGenerator({
  passwordStrategy,
  forcePasswordChange,
  onPasswordStrategyChange,
  onForcePasswordChangeChange,
  branch,
  enrollmentNo,
  mobile,
  showPreview = true
}: PasswordGeneratorProps) {
  const patternPreview =
    branch && enrollmentNo && mobile && enrollmentNo.length >= 4 && mobile.length >= 4
      ? generatePatternPassword(branch, enrollmentNo, mobile)
      : "Enter enrollment number, mobile, and branch to preview";

  const copyPreviewPassword = async () => {
    if (passwordStrategy !== "pattern" || patternPreview.includes("Enter")) {
      return;
    }

    try {
      await navigator.clipboard.writeText(patternPreview);
      toast.success("Password copied");
    } catch {
      toast.error("Unable to copy password");
    }
  };

  return (
    <div className="space-y-4 rounded-md border border-neutral-200 p-4">
      <div className="space-y-2">
        <Label>Password generation</Label>
        <RadioGroup
          value={passwordStrategy}
          onValueChange={(value) => onPasswordStrategyChange(value as PasswordStrategy)}
          className="grid gap-2 sm:grid-cols-2"
        >
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 p-2 text-sm">
            <RadioGroupItem value="pattern" id="pattern-password" />
            <span>Pattern-based</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 p-2 text-sm">
            <RadioGroupItem value="random" id="random-password" />
            <span>Random strong password</span>
          </label>
        </RadioGroup>
      </div>

      {showPreview ? (
        <div className="space-y-2 rounded-md bg-neutral-50 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Generated Password Preview</div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
              <KeyRound className="h-4 w-4 text-neutral-500" />
              {passwordStrategy === "pattern" ? patternPreview : "Random password generated securely at submit time"}
            </div>
            {passwordStrategy === "pattern" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyPreviewPassword}
                disabled={patternPreview.includes("Enter")}
              >
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copy
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={forcePasswordChange} onCheckedChange={(checked) => onForcePasswordChangeChange(checked === true)} />
        Force password change on first login
      </label>
    </div>
  );
}
