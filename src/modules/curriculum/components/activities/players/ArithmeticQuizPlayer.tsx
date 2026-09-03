import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { ArithmeticQuizContent } from "@/modules/curriculum/lib/h5p-types";

interface Problem { a: number; b: number; op: string; answer: number; display: string; }

function generateProblems(content: ArithmeticQuizContent): Problem[] {
  const problems: Problem[] = [];
  const ops = content.operations;
  const opSymbols = { add: "+", subtract: "−", multiply: "×", divide: "÷" };
  for (let i = 0; i < content.questionCount; i++) {
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a: number, b: number, answer: number;
    switch (op) {
      case "add": a = Math.floor(Math.random() * content.maxNumber) + 1; b = Math.floor(Math.random() * content.maxNumber) + 1; answer = a + b; break;
      case "subtract": a = Math.floor(Math.random() * content.maxNumber) + 1; b = Math.floor(Math.random() * a) + 1; answer = a - b; break;
      case "multiply": a = Math.floor(Math.random() * 12) + 1; b = Math.floor(Math.random() * 12) + 1; answer = a * b; break;
      case "divide": b = Math.floor(Math.random() * 12) + 1; answer = Math.floor(Math.random() * 12) + 1; a = b * answer; break;
      default: a = 1; b = 1; answer = 2;
    }
    problems.push({ a, b, op, answer, display: `${a} ${opSymbols[op as keyof typeof opSymbols]} ${b}` });
  }
  return problems;
}

interface Props { content: ArithmeticQuizContent; }

export function ArithmeticQuizPlayer({ content }: Props) {
  const [problems, setProblems] = useState(() => generateProblems(content));
  const [idx, setIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(content.timeLimit);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setTimeLeft(t => {
      if (t <= 1) { setDone(true); return 0; }
      return t - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [done]);

  const submit = () => {
    if (parseInt(userAnswer) === problems[idx].answer) setScore(s => s + 1);
    if (idx + 1 < problems.length) { setIdx(i => i + 1); setUserAnswer(""); }
    else setDone(true);
  };

  if (done) {
    return (
      <div className="text-center space-y-3 py-6">
        <p className="text-lg font-semibold">Time's up!</p>
        <p className="text-2xl font-bold text-primary">{score}/{problems.length}</p>
        <Button onClick={() => { setProblems(generateProblems(content)); setIdx(0); setScore(0); setTimeLeft(content.timeLimit); setDone(false); setUserAnswer(""); }}>
          Play Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Q{idx + 1}/{problems.length}</span>
        <span className="text-xs font-mono text-muted-foreground">{timeLeft}s</span>
      </div>
      <Progress value={(timeLeft / content.timeLimit) * 100} className="h-2" />
      <div className="text-center py-6">
        <p className="text-3xl font-bold font-mono">{problems[idx].display} = ?</p>
      </div>
      <div className="flex gap-2 max-w-xs mx-auto">
        <Input type="number" value={userAnswer} onChange={e => setUserAnswer(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} className="text-center text-lg" autoFocus />
        <Button onClick={submit}>→</Button>
      </div>
    </div>
  );
}
