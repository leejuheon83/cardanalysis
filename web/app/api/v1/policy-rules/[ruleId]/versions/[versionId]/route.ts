import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { requireSessionUser, toVersionResponse } from "@/lib/policy-rules/service";

export async function GET(
  _req: Request,
  { params }: { params: { ruleId: string; versionId: string } },
) {
  const session = await getServerSession(authOptions);
  const auth = requireSessionUser(session);
  if (!auth.ok) return auth.response;

  const version = await prisma.policyRuleVersion.findFirst({
    where: { id: params.versionId, policyRuleId: params.ruleId },
    include: { conditions: true, scopes: true, exceptions: true },
  });
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  return NextResponse.json(toVersionResponse(version));
}

