import { NextRequest, NextResponse } from 'next/server';
import { incrementReadCount, getNote, deleteNote } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const note = getNote(id);

    if (!note) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    // Increment the read count
    incrementReadCount(id);

    // Check if we've reached max reads and should delete
    const updatedNote = getNote(id);
    if (updatedNote && updatedNote.maxReads !== null && updatedNote.currentReads >= updatedNote.maxReads) {
      deleteNote(id);
      return NextResponse.json({
        success: true,
        deleted: true,
        currentReads: updatedNote.currentReads
      });
    }

    return NextResponse.json({
      success: true,
      deleted: false,
      currentReads: updatedNote?.currentReads || note.currentReads + 1
    });
  } catch (error) {
    console.error('Error incrementing read count:', error);
    return NextResponse.json(
      { error: 'Failed to increment read count' },
      { status: 500 }
    );
  }
}
