import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import type {
  AuditLogChange,
  AuditLogRecordInput,
  AuditLogTarget,
} from '../../../shared/audit-log-document';
import { buildAuditLogChanges } from '../../../shared/audit-log.util';
import { omitUndefinedFields } from '../../../shared/omit-undefined-fields';
import { AuthService } from '../auth.service';
import { CurrentTenantService } from '../current-tenant.service';

interface ResolvedActor {
  uid: string;
  displayName: string;
  email?: string;
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthService);
  private readonly tenantService = inject(CurrentTenantService);

  private actorCache: ResolvedActor | null = null;

  /**
   * 監査ログを記録する。本処理の失敗時は例外を投げず console に出力する。
   */
  async record(input: AuditLogRecordInput): Promise<void> {
    try {
      const actor = await this.resolveActor();
      const payload = {
        ...omitUndefinedFields({
          actorUid: actor.uid,
          actorDisplayName: actor.displayName,
          actorEmail: actor.email,
          targetKind: input.target.kind,
          targetEid: input.target.eid,
          targetDisplayName: input.target.displayName,
          targetEmployeeId: input.target.employeeId,
          targetResourceId: input.target.resourceId,
          targetLabel: input.target.label,
          action: input.action,
          category: input.category,
          summary: input.summary,
          changes: input.changes,
          metadata: input.metadata,
        }),
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(this.firestore, 'tenants', input.tid, 'auditLogs'), payload);
    } catch (error) {
      console.error('[AuditLogService] failed to record audit log', {
        input,
        error,
      });
    }
  }

  async recordUpdate(input: {
    tid: string;
    category: string;
    summary: string;
    target: AuditLogTarget;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    fields?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const changes = buildAuditLogChanges(input.before, input.after, input.fields);
      await this.record({
        tid: input.tid,
        action: 'update',
        category: input.category,
        summary: input.summary,
        target: input.target,
        changes,
        metadata: input.metadata,
      });
    } catch (error) {
      console.error('[AuditLogService] failed to record audit log', { input, error });
    }
  }

  async recordCreate(input: {
    tid: string;
    category: string;
    summary: string;
    target: AuditLogTarget;
    after?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const changes: AuditLogChange[] | undefined = input.after
        ? buildAuditLogChanges({}, input.after)
        : undefined;
      await this.record({
        tid: input.tid,
        action: 'create',
        category: input.category,
        summary: input.summary,
        target: input.target,
        changes,
        metadata: input.metadata,
      });
    } catch (error) {
      console.error('[AuditLogService] failed to record audit log', { input, error });
    }
  }

  async recordDelete(input: {
    tid: string;
    category: string;
    summary: string;
    target: AuditLogTarget;
    before?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const changes: AuditLogChange[] | undefined = input.before
        ? buildAuditLogChanges(input.before, {})
        : undefined;
      await this.record({
        tid: input.tid,
        action: 'delete',
        category: input.category,
        summary: input.summary,
        target: input.target,
        changes,
        metadata: input.metadata,
      });
    } catch (error) {
      console.error('[AuditLogService] failed to record audit log', { input, error });
    }
  }

  employeeTarget(
    eid: string,
    displayName: string,
    employeeId?: string,
    resourceId?: string,
    label?: string,
  ): AuditLogTarget {
    return {
      kind: 'employee',
      eid,
      displayName,
      employeeId,
      resourceId,
      label,
    };
  }

  tenantTarget(tid: string, tenantName?: string): AuditLogTarget {
    return {
      kind: 'tenant',
      resourceId: tid,
      label: tenantName,
    };
  }

  monthlyTarget(yyyyMm: string, label?: string): AuditLogTarget {
    return {
      kind: 'monthly',
      resourceId: yyyyMm,
      label: label ?? yyyyMm,
    };
  }

  bonusTarget(yyyyMm: string, label?: string): AuditLogTarget {
    return {
      kind: 'bonus',
      resourceId: yyyyMm,
      label: label ?? yyyyMm,
    };
  }

  settingsTarget(settingId: string, label?: string): AuditLogTarget {
    return {
      kind: 'settings',
      resourceId: settingId,
      label,
    };
  }

  private async resolveActor(): Promise<ResolvedActor> {
    const uid = this.authService.uid();
    if (!uid) {
      throw new Error('監査ログの実行者が特定できません。');
    }

    if (this.actorCache?.uid === uid) {
      return this.actorCache;
    }

    const affiliation = this.tenantService.currentAffiliation();
    const email = this.authService.email() ?? undefined;
    let displayName = affiliation?.displayName?.trim() ?? '';

    if (!displayName) {
      const accountSnap = await getDoc(doc(this.firestore, 'accounts', uid));
      if (accountSnap.exists()) {
        const account = accountSnap.data();
        const personal = account['personalInfo'] as
          | { realName?: { lastName?: string; firstName?: string } }
          | undefined;
        const lastName = personal?.realName?.lastName ?? '';
        const firstName = personal?.realName?.firstName ?? '';
        displayName = `${lastName}${firstName}`.trim();
      }
    }

    if (!displayName) {
      displayName = email ?? uid;
    }

    this.actorCache = { uid, displayName, email };
    return this.actorCache;
  }
}
