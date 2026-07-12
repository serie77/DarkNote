import { NextRequest, NextResponse } from 'next/server';
import { getNote, deleteNote } from '@/lib/db';

export async function GET(
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

    // Check if note has exceeded max reads
    if (note.maxReads !== null && note.currentReads >= note.maxReads) {
      // Delete the note if it's exceeded max reads
      deleteNote(id);
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    // Don't increment read count on GET - only on decrypt
    // Return current count as-is

    // ZERO-KNOWLEDGE ASYMMETRIC: Return encrypted data + ephemeral public key
    // Server cannot decrypt - only recipient's secret key can decrypt
    return NextResponse.json({
      id: note.id,
      ciphertext: note.ciphertext,
      nonce: note.nonce,
      ephemeralPublicKey: note.ephemeralPublicKey,
      recipientAddress: note.recipientAddress,
      selfDestruct: note.selfDestruct,
      maxReads: note.maxReads,
      currentReads: note.currentReads,
    });
  } catch (error) {
    console.error('Error fetching note:', error);
    return NextResponse.json(
      { error: 'Failed to fetch note' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const deleted = deleteNote(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Note deleted',
    });
  } catch (error) {
    console.error('Error deleting note:', error);
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    );
  }
}
