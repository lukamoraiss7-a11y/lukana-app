import { NextResponse } from 'next/server';
import { todaySubmissions, submissionsByDate, updateSubmissionAction, deleteSubmission } from '@/lib/db';

const todayDate = () => new Date().toISOString().slice(0, 10);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const data = date ? await submissionsByDate(date) : await todaySubmissions();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { name, action } = await request.json();
    await updateSubmissionAction(todayDate(), name, action);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { name } = await request.json();
    await deleteSubmission(todayDate(), name);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
