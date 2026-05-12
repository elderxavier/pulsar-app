import { Injectable, inject } from '@angular/core';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp,
  where,
  limit,
  type Unsubscribe,
} from 'firebase/firestore';
import { fbDb } from './firebase';
import { AuthService } from './auth.service';
import { AuditService } from './audit.service';

export type ReportStatus = 'open' | 'reviewing' | 'dismissed' | 'actioned';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'violence'
  | 'sexual_content'
  | 'misinformation'
  | 'other';

export interface Report {
  id: string;
  postId: string;
  postPreview: string;
  reportedUserId: string;
  reportedUserName: string;
  reporterId: string;
  reporterName: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  createdAt: Timestamp;
  resolvedAt?: Timestamp;
  resolvedBy?: string;
  resolutionNote?: string;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private auth = inject(AuthService);
  private audit = inject(AuditService);

  listenAll(callback: (reports: Report[]) => void, lim = 200): Unsubscribe {
    const q = query(
      collection(fbDb(), 'reports'),
      orderBy('createdAt', 'desc'),
      limit(lim),
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => this.fromDoc(d.id, d.data())));
    }, (err) => console.error('[Reports] listen', err));
  }

  listenOpen(callback: (reports: Report[]) => void): Unsubscribe {
    const q = query(
      collection(fbDb(), 'reports'),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => this.fromDoc(d.id, d.data())));
    }, (err) => console.error('[Reports] listenOpen', err));
  }

  async setStatus(reportId: string, status: ReportStatus, note?: string): Promise<void> {
    const user = this.auth.user();
    await updateDoc(doc(fbDb(), 'reports', reportId), {
      status,
      resolvedAt: Timestamp.now(),
      resolvedBy: user?.uid ?? 'unknown',
      resolutionNote: note ?? '',
    });
    await this.audit.log({
      action: `report.${status}`,
      target: reportId,
      reason: note,
    });
  }

  private fromDoc(id: string, data: any): Report {
    return {
      id,
      postId: data.postId ?? '',
      postPreview: data.postPreview ?? '',
      reportedUserId: data.reportedUserId ?? '',
      reportedUserName: data.reportedUserName ?? 'Anônimo',
      reporterId: data.reporterId ?? '',
      reporterName: data.reporterName ?? 'Anônimo',
      reason: (data.reason ?? 'other') as ReportReason,
      details: data.details ?? '',
      status: (data.status ?? 'open') as ReportStatus,
      createdAt: data.createdAt ?? Timestamp.now(),
      resolvedAt: data.resolvedAt ?? undefined,
      resolvedBy: data.resolvedBy ?? '',
      resolutionNote: data.resolutionNote ?? '',
    };
  }
}
