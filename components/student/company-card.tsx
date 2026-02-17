"use client";

import Image from "next/image";
import { Building2, CheckCircle2 } from "lucide-react";
import { CompanyCriteria, Database } from "@/types/database.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

interface CompanyCardProps {
  company: CompanyRow;
  criteria: CompanyCriteria;
  hasApplied: boolean;
  onApply: (companyId: string) => Promise<void>;
  applying: boolean;
}

export function CompanyCard({ company, criteria, hasApplied, onApply, applying }: CompanyCardProps) {
  const branchesText = criteria.branches?.join(", ") || "All branches";

  return (
    <Card className="h-full">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-3">
          {company.logo_url ? (
            <Image
              src={company.logo_url}
              alt={`${company.name} logo`}
              width={48}
              height={48}
              className="h-12 w-12 rounded-md border object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <CardTitle className="text-lg">{company.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="line-clamp-2 text-sm text-muted-foreground">{company.description ?? "No description available."}</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="info">CGPA {criteria.cgpa_min.toFixed(1)}+</Badge>
          {typeof criteria.tenth_min === "number" ? <Badge variant="secondary">10th {criteria.tenth_min}%+</Badge> : null}
          {typeof criteria.twelfth_min === "number" ? (
            <Badge variant="secondary">12th {criteria.twelfth_min}%+</Badge>
          ) : null}
          <Badge variant="outline">{branchesText}</Badge>
        </div>
      </CardContent>
      <CardFooter>
        {hasApplied ? (
          <Button className="w-full" variant="success" disabled>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Applied ✓
          </Button>
        ) : (
          <Button className="w-full" onClick={() => void onApply(company.id)} disabled={applying}>
            {applying ? "Applying..." : "Apply Now"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
