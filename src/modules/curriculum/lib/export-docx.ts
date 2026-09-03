import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import type { Quiz, QuizQuestion } from '../config/canvas-api';
import type { NGSSStandard } from './ngss-api';

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function getLetterLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

function buildQuestionParagraphs(
  question: QuizQuestion,
  index: number,
  showAnswers: boolean,
  standards?: NGSSStandard[]
): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Question number + text
  paragraphs.push(
    new Paragraph({
      spacing: { before: 300, after: 100 },
      children: [
        new TextRun({ text: `${index + 1}. `, bold: true, size: 24 }),
        new TextRun({ text: stripHtml(question.question_text), size: 24 }),
        new TextRun({ text: `  (${question.points_possible} pts)`, size: 20, italics: true, color: '666666' }),
      ],
    })
  );

  // NGSS standards line
  if (standards && standards.length > 0) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 40, after: 60 },
        indent: { left: 360 },
        children: [
          new TextRun({ text: 'NGSS: ', bold: true, size: 18, color: '1a6b3c' }),
          ...standards.flatMap((s, i) => [
            ...(i > 0 ? [new TextRun({ text: ', ', size: 18, color: '1a6b3c' })] : []),
            new TextRun({ text: s.code, bold: true, size: 18, color: '1a6b3c' }),
            new TextRun({ text: ` (${s.description})`, size: 18, italics: true, color: '4a8c64' }),
          ]),
        ],
      })
    );
  }

  // Answer choices
  if (question.answers && question.answers.length > 0) {
    const isMultipleChoice = ['multiple_choice_question', 'true_false_question', 'multiple_answers_question'].includes(question.question_type);

    if (isMultipleChoice) {
      question.answers.forEach((answer, ai) => {
        const isCorrect = answer.weight > 0;
        const label = getLetterLabel(ai);
        const answerText = stripHtml(answer.html || answer.text || '');

        paragraphs.push(
          new Paragraph({
            spacing: { before: 60 },
            indent: { left: 720 },
            children: [
              new TextRun({
                text: `${label}) ${answerText}`,
                size: 22,
                bold: showAnswers && isCorrect,
                color: showAnswers && isCorrect ? '16a34a' : '000000',
              }),
              ...(showAnswers && isCorrect
                ? [new TextRun({ text: ' ✓', bold: true, color: '16a34a', size: 22 })]
                : []),
            ],
          })
        );
      });
    } else if (showAnswers && question.question_type === 'short_answer_question') {
      const correctAnswers = question.answers.filter(a => a.weight > 0);
      if (correctAnswers.length > 0) {
        paragraphs.push(
          new Paragraph({
            spacing: { before: 60 },
            indent: { left: 720 },
            children: [
              new TextRun({ text: 'Answer: ', bold: true, color: '16a34a', size: 22 }),
              new TextRun({ text: correctAnswers.map(a => stripHtml(a.html || a.text || '')).join(' or '), color: '16a34a', size: 22 }),
            ],
          })
        );
      }
    } else if (!showAnswers && ['short_answer_question', 'essay_question', 'numerical_question'].includes(question.question_type)) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 100 },
          indent: { left: 720 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999', space: 1 } },
          children: [new TextRun({ text: '', size: 22 })],
        })
      );
      paragraphs.push(
        new Paragraph({
          spacing: { before: 200 },
          indent: { left: 720 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999', space: 1 } },
          children: [new TextRun({ text: '', size: 22 })],
        })
      );
    }
  }

  return paragraphs;
}

function createDocument(
  quiz: Quiz,
  questions: QuizQuestion[],
  showAnswers: boolean,
  courseName: string,
  ngssTags?: Map<number, NGSSStandard[]>
): Document {
  const sections: Paragraph[] = [];

  // Title
  sections.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: quiz.title, bold: true, size: 36 })],
    })
  );

  // Course name
  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 50 },
      children: [new TextRun({ text: courseName, size: 24, color: '666666' })],
    })
  );

  // Answer key subtitle
  if (showAnswers) {
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [new TextRun({ text: '— ANSWER KEY —', bold: true, size: 28, color: '16a34a' })],
      })
    );
  }

  // NGSS note
  if (ngssTags && ngssTags.size > 0) {
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 50 },
        children: [new TextRun({ text: 'Aligned to Next Generation Science Standards (NGSS)', size: 20, italics: true, color: '1a6b3c' })],
      })
    );
  }

  // Info line
  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({ text: `${questions.length} Questions`, size: 22, color: '666666' }),
        new TextRun({ text: `  •  ${quiz.points_possible} Points`, size: 22, color: '666666' }),
      ],
    })
  );

  // Student name line
  if (!showAnswers) {
    sections.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({ text: 'Name: ', bold: true, size: 24 }),
          new TextRun({ text: '________________________________________', size: 24 }),
        ],
      })
    );
    sections.push(
      new Paragraph({
        spacing: { after: 300 },
        children: [
          new TextRun({ text: 'Date: ', bold: true, size: 24 }),
          new TextRun({ text: '________________________________________', size: 24 }),
        ],
      })
    );
  }

  // Separator
  sections.push(
    new Paragraph({
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: '333333', space: 1 } },
      children: [],
    })
  );

  // Questions
  const filteredQuestions = questions.filter(q => q.question_type !== 'text_only_question');
  filteredQuestions.forEach((question, index) => {
    const standards = ngssTags?.get(question.id);
    sections.push(...buildQuestionParagraphs(question, index, showAnswers, standards));
  });

  return new Document({
    sections: [{ children: sections }],
  });
}

export async function exportQuizToDocx(
  quiz: Quiz,
  questions: QuizQuestion[],
  courseName: string,
  includeAnswerKey: boolean,
  ngssTags?: Map<number, NGSSStandard[]>
) {
  const studentDoc = createDocument(quiz, questions, false, courseName, ngssTags);
  const studentBlob = await Packer.toBlob(studentDoc);
  const safeName = quiz.title.replace(/[^a-zA-Z0-9]/g, '_');
  saveAs(studentBlob, `${safeName}_Quiz.docx`);

  if (includeAnswerKey) {
    const answerDoc = createDocument(quiz, questions, true, courseName, ngssTags);
    const answerBlob = await Packer.toBlob(answerDoc);
    saveAs(answerBlob, `${safeName}_Answer_Key.docx`);
  }
}
