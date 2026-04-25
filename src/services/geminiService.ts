import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function summarizeEntries(entries: { date: string; content: string }[], period: "주간" | "월간" | "연간") {
  if (entries.length === 0) return "작성된 일기가 없어 요약할 수 없습니다.";

  const prompt = `
    당신은 일기 요약 전문가입니다. 아래에 제공된 ${period} 동안의 일기 기록과 일정 목록을 바탕으로, 실제 발생한 사건들을 중심으로 함축적으로 요약해주세요.

    **제약 사항:**
    1. '전문가의 한마디', '조언', '인사말' 등 본문 요약과 관계없는 서술은 일체 제외하세요.
    2. 불필요한 미사여구를 빼고 건조하고 명확하게 사실 위주로 작성하세요.
    3. 반드시 아래 두 카테고리로 구분하여 요약하세요.
       - [업무 성과 및 진행]
       - [개인 일정 및 일상]

    **일기 및 일정 목록:**
    ${entries.map(e => `[${e.date}]: ${e.content}`).join('\n')}
    
    요약 결과는 위 카테고리에 맞춰 한글로 작성해주세요.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || "요약을 생성하는 중 오류가 발생했습니다.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI 요약을 생성하는 데 실패했습니다. 다시 시도해주세요.";
  }
}

export async function polishRecord(content: string) {
  if (!content.trim()) return content;

  const prompt = `
    당신은 전문적인 비즈니스 문서 작성 전문가입니다. 아래의 거친 메모나 일기 내용을 바탕으로, 공무원 업무수첩에 어울리는 '공식 업무 기록' 형태로 다듬어주세요.
    
    **작성 가이드:**
    1. 개조식(Bullet points)을 사용하여 명확하게 작성하세요.
    2. 전문적인 비즈니스 용어를 사용하되, 품격 있는 문체로 작성하세요 (예: ~함, ~일, ~중).
    3. 불필요한 사담은 제거하고 핵심 업무 내용 위주로 정리하세요.
    4. [주요 업무], [진행 사항], [향후 계획] 등의 소제목으로 구분하여 정리하세요.

    **원본 내용:**
    ${content}

    변환된 공식 업무 기록:
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || content;
  } catch (error) {
    console.error("Gemini Polishing Error:", error);
    return content;
  }
}

export async function analyzeDocumentImage(imageBuffer: ArrayBuffer, mimeType: string) {
  const prompt = `
    당신은 문서 분석 전문가입니다. 제공된 이미지(사진)는 업무 관련 메모, 회의록, 또는 현장 사진일 수 있습니다.
    이미지에서 텍스트와 주요 내용을 추출하여 '공무원 업무 일지'에 어울리는 공식적인 기록으로 요약해주세요.

    **작성 가이드:**
    1. 핵심 업무 내용, 결정 사항, 일정 등을 중심으로 개조식으로 요약하세요.
    2. 전문적인 비즈니스 용어를 사용하세요 (예: ~함, ~일, ~완료).
    3. 이미지에 텍스트가 없다면 보이는 상황을 객관적으로 설명하세요.
    4. 너무 길지 않게 핵심만 3~5줄 내외로 작성하세요.

    요약된 업무 기록:
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: Buffer.from(imageBuffer).toString("base64"),
              mimeType
            }
          }
        ]
      }],
    });

    return response.text || "이미지 분석 결과를 가져올 수 없습니다.";
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    return "이미지 분석 중 오류가 발생했습니다.";
  }
}

export async function analyzeCareerImage(imageBuffer: ArrayBuffer, mimeType: string) {
  const prompt = `
    당신은 인사 기록 전문가입니다. 제공된 이미지(사진)에서 인사 발령, 승진, 임용 관련 정보를 추출하여 JSON 형식으로 응답해주세요.
    
    추출할 정보:
    1. 신규 임용일 (appointmentDate, YYYY-MM-DD 형식)
    2. 승진 이력 (promotions: [{ rank: "직급", date: "YYYY-MM-DD" }])
    3. 인사 발령/부서 배치 (assignments: [{ department: "부서명", date: "YYYY-MM-DD", role: "직무" }])

    **주의사항:**
    - 반드시 유효한 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.
    - 날짜 형식을 엄수하세요. 날짜 정보를 찾을 수 없으면 빈 문자열로 두세요.
    - 이미지에 해당 정보가 없으면 빈 배열([])로 응답하세요.

    JSON 응답 예시:
    {
      "appointmentDate": "2020-01-01",
      "promotions": [{"rank": "8급", "date": "2021-07-01"}],
      "assignments": [{"department": "기획팀", "date": "2020-01-01", "role": "주무관"}]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: Buffer.from(imageBuffer).toString("base64"),
              mimeType
            }
          }
        ]
      }],
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Career Analysis Error:", error);
    return null;
  }
}
