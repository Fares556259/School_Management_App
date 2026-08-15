export interface SubjectHierarchy {
  id: number;
  name: string;
  domain: string;
  parentId: number | null;
}

/**
 * Given a flat list of all subjects (parents and components),
 * returns the array of subjects that should actually be graded.
 * 
 * Rule: 
 * If a parent subject has components, return the components.
 * If a parent subject has NO components, return the parent subject itself.
 * Never return both a parent and its components.
 */
export function getGradeSubjects<T extends SubjectHierarchy>(allSubjects: T[]): T[] {
  const gradeSubjects: T[] = [];
  const parentIdMap = new Map<number, T[]>();
  const parentSubjects: T[] = [];

  // Group by parentId
  allSubjects.forEach(subject => {
    if (subject.parentId === null) {
      parentSubjects.push(subject);
    } else {
      if (!parentIdMap.has(subject.parentId)) {
        parentIdMap.set(subject.parentId, []);
      }
      parentIdMap.get(subject.parentId)!.push(subject);
    }
  });

  // Apply the rule
  parentSubjects.forEach(parent => {
    const components = parentIdMap.get(parent.id);
    if (components && components.length > 0) {
      // Parent has components -> add components for grading
      gradeSubjects.push(...components);
    } else {
      // Parent has no components -> add parent for grading
      gradeSubjects.push(parent);
    }
  });

  return gradeSubjects;
}
