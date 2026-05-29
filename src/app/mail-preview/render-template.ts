export function renderInvitationTemplate(
    template: string,
    values: Record<string, string>,
  ): string {
    return template.replace(/\{\s*(\w+)\s*\}/g, (_, key: string) => values[key] ?? '');
  }