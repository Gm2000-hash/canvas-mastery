import { useState, useMemo, useEffect } from "react";
import { usePageTitle } from "@/modules/curriculum/config/page-title";
import { useNavigate } from "@/modules/curriculum/config/router";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { AppNavSheet } from "@/modules/curriculum/config/chrome-nav-sheet";
import { Breadcrumbs } from "@/modules/curriculum/config/chrome-breadcrumbs";
import { PageBanner } from "@/modules/curriculum/config/chrome-page-banner";
import { ALL_SUBSTANDARDS } from "@/modules/curriculum/lib/ngss-data";
import { ALL_IDAHO_STANDARDS, ALL_IDAHO_STANDARDS_FLAT, IDAHO_CATEGORY_LABELS } from "@/modules/curriculum/lib/idaho-standards-data";
import { supabase } from "@/modules/curriculum/config/supabase";
import { useAuth } from "@/modules/curriculum/config/auth";
import { toast } from "sonner";
import { Search, BookOpen, FlaskConical, Calculator, Landmark, Filter, Tag, Plus, X, Save, Loader2, Sparkles } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  essential: "bg-primary/10 text-primary border-primary/20",
  supporting: "bg-accent/10 text-accent border-accent/20",
  additional: "bg-muted text-muted-foreground border-border",
  teacher_guidance: "bg-warning/10 text-warning border-warning/20",
  big_idea: "bg-chart-3/10 text-chart-3 border-chart-3/20",
};

const SUBJECT_ICONS: Record<string, React.ElementType> = {
  "ELA": BookOpen,
  "Math": Calculator,
  "Social Studies": Landmark,
  "Science": FlaskConical,
};

// Inline key terms editor
function KeyTermsEditor({
  code,
  defaultTerms,
  customTerms,
  onSave,
}: {
  code: string;
  defaultTerms: string[];
  customTerms: string[];
  onSave: (code: string, terms: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [terms, setTerms] = useState<string[]>([]);
  const [newTerm, setNewTerm] = useState("");

  // Merge default + custom for display
  const allTerms = useMemo(() => {
    return [...new Set([...defaultTerms, ...customTerms])];
  }, [defaultTerms, customTerms]);

  const startEditing = () => {
    setTerms([...allTerms]);
    setEditing(true);
  };

  const addTerm = () => {
    const t = newTerm.trim().toLowerCase();
    if (t && !terms.includes(t)) {
      setTerms([...terms, t]);
      setNewTerm("");
    }
  };

  const removeTerm = (term: string) => {
    setTerms(terms.filter(t => t !== term));
  };

  const handleSave = () => {
    onSave(code, terms);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-1 mt-1.5">
        <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
        {allTerms.slice(0, 8).map(t => (
          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{t}</span>
        ))}
        {allTerms.length > 8 && (
          <span className="text-[10px] text-muted-foreground">+{allTerms.length - 8} more</span>
        )}
        <button onClick={startEditing} className="text-[10px] text-primary hover:underline ml-1">Edit</button>
      </div>
    );
  }

  return (
    <div className="mt-2 p-2 rounded-lg border border-border bg-muted/30 space-y-2">
      <div className="flex flex-wrap gap-1">
        {terms.map(t => (
          <span key={t} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
            {t}
            <button onClick={() => removeTerm(t)} className="hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <Input
          value={newTerm}
          onChange={e => setNewTerm(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTerm(); } }}
          placeholder="Add key term..."
          className="h-7 text-xs flex-1"
        />
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={addTerm}><Plus className="h-3 w-3" /></Button>
      </div>
      <div className="flex gap-1 justify-end">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave}><Save className="h-3 w-3" /> Save</Button>
      </div>
    </div>
  );
}

export default function StandardsBrowser() {
  usePageTitle("Standards Browser");
  const navigate = useNavigate();
  const { user } = useAuth();
  const [framework, setFramework] = useState<"idaho" | "ngss">("idaho");
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [customKeyTerms, setCustomKeyTerms] = useState<Record<string, string[]>>({});
  const [savingTerms, setSavingTerms] = useState(false);
  const [generatingKeyTerms, setGeneratingKeyTerms] = useState(false);
  const [genProgress, setGenProgress] = useState("");

  // Fetch custom key terms from DB
  useEffect(() => {
    if (!user) return;
    supabase
      .from('standard_key_terms')
      .select('standard_code, key_terms')
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string[]> = {};
          for (const row of data) {
            map[row.standard_code] = row.key_terms || [];
          }
          setCustomKeyTerms(map);
        }
      });
  }, [user]);

  const handleSaveKeyTerms = async (code: string, terms: string[]) => {
    if (!user) return;
    setSavingTerms(true);
    try {
      const { error } = await supabase
        .from('standard_key_terms')
        .upsert({
          user_id: user.id,
          standard_code: code,
          key_terms: terms,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,standard_code' });

      if (error) throw error;
      setCustomKeyTerms(prev => ({ ...prev, [code]: terms }));
      toast.success(`Key terms updated for ${code}`);
    } catch (e: any) {
      toast.error('Failed to save key terms');
      console.error(e);
    } finally {
      setSavingTerms(false);
    }
  };

  const handleBulkGenerateKeyTerms = async () => {
    if (!user || generatingKeyTerms) return;

    // Get Idaho standards that don't have custom key terms yet
    const standardsToGenerate = ALL_IDAHO_STANDARDS_FLAT.filter(
      s => !(customKeyTerms[s.code] && customKeyTerms[s.code].length > 0)
    );

    if (standardsToGenerate.length === 0) {
      toast.info("All Idaho standards already have key terms!");
      return;
    }

    setGeneratingKeyTerms(true);
    setGenProgress(`Generating key terms for ${standardsToGenerate.length} standards...`);

    try {
      const { data, error } = await supabase.functions.invoke('generate-key-terms', {
        body: {
          standards: standardsToGenerate.map(s => ({ code: s.code, description: s.description })),
        },
      });

      if (error) throw new Error(error.message || 'Failed to generate key terms');
      if (data?.error) throw new Error(data.error);

      const results: { code: string; key_terms: string[] }[] = data.results || [];
      setGenProgress(`Saving ${results.length} key term sets...`);

      // Batch upsert to DB
      const upsertRows = results
        .filter(r => r.key_terms && r.key_terms.length > 0)
        .map(r => ({
          user_id: user.id,
          standard_code: r.code,
          key_terms: r.key_terms.map(t => t.toLowerCase()),
          updated_at: new Date().toISOString(),
        }));

      if (upsertRows.length > 0) {
        const { error: upsertError } = await supabase
          .from('standard_key_terms')
          .upsert(upsertRows, { onConflict: 'user_id,standard_code' });

        if (upsertError) throw upsertError;

        // Update local state
        const newTerms = { ...customKeyTerms };
        for (const r of results) {
          if (r.key_terms?.length > 0) {
            newTerms[r.code] = r.key_terms.map(t => t.toLowerCase());
          }
        }
        setCustomKeyTerms(newTerms);
      }

      toast.success(`Generated key terms for ${results.length} standards!`);
    } catch (err: any) {
      console.error('Bulk key terms generation failed:', err);
      toast.error(err?.message || 'Failed to generate key terms');
    } finally {
      setGeneratingKeyTerms(false);
      setGenProgress("");
    }
  };

  // NGSS flat list
  const ngssFlat = useMemo(() =>
    Object.entries(ALL_SUBSTANDARDS).flatMap(([group, standards]) =>
      standards.map(s => ({ ...s, group }))
    ), []
  );

  const ngssGroups = Object.keys(ALL_SUBSTANDARDS);

  const filteredIdaho = useMemo(() => {
    let standards = ALL_IDAHO_STANDARDS_FLAT;
    if (gradeFilter !== "all") {
      const [subject, grade] = gradeFilter.split("|");
      standards = standards.filter(s => s.subject === subject && s.grade === grade);
    }
    if (categoryFilter !== "all") {
      standards = standards.filter(s => s.category === categoryFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      standards = standards.filter(s =>
        s.code.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (customKeyTerms[s.code] || []).some(t => t.toLowerCase().includes(q))
      );
    }
    return standards;
  }, [gradeFilter, categoryFilter, search, customKeyTerms]);

  const filteredNgss = useMemo(() => {
    let standards = ngssFlat;
    if (gradeFilter !== "all") {
      standards = standards.filter(s => s.group === gradeFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      standards = standards.filter(s =>
        s.code.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.keyTerms.some(t => t.toLowerCase().includes(q))
      );
    }
    return standards;
  }, [ngssFlat, gradeFilter, search]);

  const idahoStats = useMemo(() => {
    const filtered = gradeFilter !== "all"
      ? ALL_IDAHO_STANDARDS_FLAT.filter(s => {
          const [subject, grade] = gradeFilter.split("|");
          return s.subject === subject && s.grade === grade;
        })
      : ALL_IDAHO_STANDARDS_FLAT;
    return {
      total: filtered.length,
      essential: filtered.filter(s => s.category === "essential").length,
      supporting: filtered.filter(s => s.category === "supporting").length,
      additional: filtered.filter(s => s.category === "additional").length,
    };
  }, [gradeFilter]);

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 h-14 border-b border-border/60 bg-white glass-header flex items-center px-4 gap-4">
        <AppNavSheet />
        <Breadcrumbs items={[{ label: "Standards Browser" }]} />
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6 bg-page-green">
        <PageBanner
          compact
          greeting="Standards Browser"
          subtitle="Browse Idaho and NGSS standards organized by subject, grade, and category"
        />
        <Tabs value={framework} onValueChange={v => { setFramework(v as any); setGradeFilter("all"); setCategoryFilter("all"); setSearch(""); }}>
          <TabsList className="w-full max-w-sm">
            <TabsTrigger value="idaho" className="flex-1 gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> Idaho Standards
            </TabsTrigger>
            <TabsTrigger value="ngss" className="flex-1 gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" /> NGSS (Science)
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={framework === "ngss" ? "Search standards or key terms..." : "Search standards or key terms..."}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {framework === "idaho" ? (
            <>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects & Grades</SelectItem>
                  {ALL_IDAHO_STANDARDS.map(gs => (
                    <SelectItem key={`${gs.subject}|${gs.grade}`} value={`${gs.subject}|${gs.grade}`}>
                      {gs.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(IDAHO_CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {ngssGroups.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {framework === "idaho" && (
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-semibold">{idahoStats.total}</span>
              <span className="text-muted-foreground">total</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <div className="h-2.5 w-2.5 rounded-full bg-primary" />
              <span className="font-medium">{idahoStats.essential}</span>
              <span className="text-muted-foreground">essential</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <div className="h-2.5 w-2.5 rounded-full bg-accent" />
              <span className="font-medium">{idahoStats.supporting}</span>
              <span className="text-muted-foreground">supporting</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground" />
              <span className="font-medium">{idahoStats.additional}</span>
              <span className="text-muted-foreground">additional</span>
            </div>
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleBulkGenerateKeyTerms}
                disabled={generatingKeyTerms}
              >
                {generatingKeyTerms ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {genProgress || "Generating..."}</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" /> Generate Key Terms with AI</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Standards list */}
        {framework === "idaho" ? (
          <div className="space-y-2">
            {filteredIdaho.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No standards match your search or filters.
                </CardContent>
              </Card>
            ) : (
              filteredIdaho.map((s, idx) => {
                const Icon = SUBJECT_ICONS[s.subject] || BookOpen;
                return (
                  <Card key={`${s.code}-${idx}`} className="hover:shadow-sm transition-shadow">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono font-semibold text-sm">{s.code}</span>
                            <Badge className={`text-[10px] px-1.5 py-0 border ${CATEGORY_COLORS[s.category] || ""}`}>
                              {IDAHO_CATEGORY_LABELS[s.category]}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {s.subject} {s.grade}
                            </Badge>
                          </div>
                         <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                          <KeyTermsEditor
                            code={s.code}
                            defaultTerms={[]}
                            customTerms={customKeyTerms[s.code] || []}
                            onSave={handleSaveKeyTerms}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNgss.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No standards match your search or filters.
                </CardContent>
              </Card>
            ) : (
              filteredNgss.map((s, idx) => (
                <Card key={`${s.code}-${idx}`} className="hover:shadow-sm transition-shadow">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <FlaskConical className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono font-semibold text-sm">{s.code}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{s.group}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                        <KeyTermsEditor
                          code={s.code}
                          defaultTerms={s.keyTerms}
                          customTerms={customKeyTerms[s.code] || []}
                          onSave={handleSaveKeyTerms}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center pb-6">
          {framework === "idaho"
            ? `Showing ${filteredIdaho.length} of ${ALL_IDAHO_STANDARDS_FLAT.length} Idaho standards`
            : `Showing ${filteredNgss.length} of ${ngssFlat.length} NGSS standards`}
        </div>
      </main>
    </div>
  );
}
