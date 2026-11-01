export namespace Highlighting {
  export function backgroundClass(property:string, id:string|number) {
    return `__hl_background_${property}_${id}`;
  }

  export function inlineClass(property:string, id:string|number) {
    return `__hl_inline_${property}_${id}`;
  }

  // Added to allow dropdowns (inline edit, filters) to style types, priorities and statuses
  // like the table does: types get colour/uppercase/weight (__hl_inline_type_<id>),
  // priorities and statuses their coloured dot. Maps the API _type to the highlight property.
  const highlightedResourceTypes:Record<string, string> = {
    Type: 'type',
    Priority: 'priority',
    Status: 'status',
  };

  // Link-only resources (e.g. selected filter values, which are just { href, title }) have no
  // _type, so the kind of resource is derived from the API path instead.
  const highlightedResourcePaths:Record<string, string> = {
    types: 'type',
    priorities: 'priority',
    statuses: 'status',
  };

  export function inlineClassForResource(
    item:{ _type?:string, id?:string|number|null, href?:string|null }|null|undefined,
  ):string|null {
    if (!item) {
      return null;
    }

    let property = item._type ? highlightedResourceTypes[item._type] : undefined;
    let id = item.id;

    if (!property && item.href) {
      const match = /\/api\/v3\/(types|priorities|statuses)\/(\d+)$/.exec(item.href);
      if (match) {
        property = highlightedResourcePaths[match[1]];
        id = match[2];
      }
    }

    if (property && id) {
      return inlineClass(property, id);
    }

    return null;
  }

  export function colorClass(highlightColorTextInline:boolean, id:string|number) {
    if (highlightColorTextInline) {
      return `__hl_inline_color_${id}_text`;
    }
    return `__hl_inline_color_${id}_dot`;
  }

  /**
   * Given the difference from today (negative = n days in the past),
   * output the fixed overdue classes
   * @param diff
   */
  export function overdueDate(diff:number):string {
    if (diff === 0) {
      return '__hl_date_due_today';
    }
    // At least one day
    if (diff <= -1) {
      return '__hl_date_overdue';
    }

    return '__hl_date_not_overdue';
  }
}
