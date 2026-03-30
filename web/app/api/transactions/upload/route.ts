import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { parseExcelBuffer } from "@/lib/excel-parse";
import { rowToTransactionInput } from "@/lib/csv-parse";
import { createTransactionWithAi } from "@/server/create-transaction-with-ai";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "file 필드 필요" }, { status: 400 });
  }

  const fileName = "name" in file ? String((file as { name?: string }).name ?? "").toLowerCase() : "";
  if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
    return NextResponse.json({ error: "엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다." }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const { rows } = parseExcelBuffer(buffer);
  if (!rows.length) {
    return NextResponse.json({ error: "엑셀에서 데이터 행을 찾지 못했습니다." }, { status: 400 });
  }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const input = rowToTransactionInput(rows[i]);
    if (!input) {
      skipped += 1;
      errors.push(`행 ${i + 2}: 금액·거래일시 열을 찾지 못했거나 값 형식이 맞지 않습니다`);
      continue;
    }
    try {
      await createTransactionWithAi({
        actorId: session.user.id,
        amount: input.amount,
        merchantName: input.merchantName,
        category: input.category,
        userLabel: input.userLabel,
        txnDate: input.txnDate,
        description: input.description,
        rawMetadata: rows[i],
      });
      created += 1;
    } catch (e) {
      skipped += 1;
      errors.push(`행 ${i + 2}: ${e instanceof Error ? e.message : "오류"}`);
    }
  }

  return NextResponse.json({
    created,
    skipped,
    errors: errors.slice(0, 20),
  });
}
