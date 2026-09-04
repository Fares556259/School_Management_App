export type UserRoleType = "teacher" | "student" | "staff" | "parent" | "admin" | string;
export type UserGenderType = "MALE" | "FEMALE" | "male" | "female" | string | null | undefined;

/**
 * Returns a role- and gender-specific default avatar URL.
 * - Teacher (male/female): /avatars/teacher_male.jpg, /avatars/teacher_female.jpg
 * - Student (male/female): /avatars/student_male.jpg, /avatars/student_female.jpg
 * - Staff (male/female): /avatars/staff_male.jpg, /avatars/staff_female.jpg
 * - Parent (male/female): /avatars/parent_male.jpg, /avatars/parent_female.jpg
 */
export function getDefaultAvatar(
  role?: UserRoleType,
  sex?: UserGenderType
): string {
  const normalizedSex = sex?.toUpperCase() === "FEMALE" ? "female" : "male";
  const normalizedRole = role?.toLowerCase() || "student";

  switch (normalizedRole) {
    case "teacher":
      return `/avatars/teacher_${normalizedSex}.jpg`;
    case "student":
      return `/avatars/student_${normalizedSex}.jpg`;
    case "staff":
    case "admin":
      return `/avatars/staff_${normalizedSex}.jpg`;
    case "parent":
      return `/avatars/parent_${normalizedSex}.jpg`;
    default:
      return `/avatars/student_${normalizedSex}.jpg`;
  }
}

/**
 * Resolves avatar URL. If user has a valid custom uploaded image, returns it.
 * Otherwise returns the gender- and role-aware default avatar.
 */
export function getUserAvatar(
  img?: string | null,
  role?: UserRoleType,
  sex?: UserGenderType
): string {
  if (
    img &&
    img !== "null" &&
    img !== "undefined" &&
    img !== "/noAvatar.png" &&
    img !== "/avatar.png" &&
    img.trim() !== ""
  ) {
    return img;
  }
  return getDefaultAvatar(role, sex);
}
