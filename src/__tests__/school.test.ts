
import { getSchoolId, getSchoolIdFromHeader } from "@/lib/school";
import { getAuthenticatedUser } from "@lib/supabase/server";
import { supabaseAdmin } from "@lib/supabase/admin";
import prisma from "@/lib/prisma";

// Mock React cache so each test calls the function independently
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  cache: (fn: (...args: any[]) => any) => fn,
}));

// Mock authentication
jest.mock("../lib/supabase/server", () => ({
  getAuthenticatedUser: jest.fn(),
}));

// Mock Supabase Admin API
jest.mock("../lib/supabase/admin", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        getUserById: jest.fn(),
      },
    },
  },
}));

// Mock Prisma
jest.mock("../lib/prisma", () => ({
  __esModule: true,
  default: {
    admin: {
      findUnique: jest.fn(),
    },
  },
}));

const mockGetAuthenticatedUser = jest.mocked(getAuthenticatedUser);
const mockGetUserById = jest.mocked(
  supabaseAdmin.auth.admin.getUserById
);
const mockFindUnique = jest.mocked(prisma.admin.findUnique);

describe("getSchoolId", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetAuthenticatedUser.mockResolvedValue({
      id: "user-123",
      user_metadata: {},
    } as any);

    mockFindUnique.mockResolvedValue(null);
    mockGetUserById.mockResolvedValue({
      data: { user: null },
    } as any);
  });

  it("should return default_school when no user is authenticated", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null as any);

    const result = await getSchoolId();

    expect(result).toBe("default_school");
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("should return schoolId from user metadata", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      id: "user-123",
      user_metadata: {
        schoolId: "school-001",
      },
    } as any);

    const result = await getSchoolId();

    expect(result).toBe("school-001");
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockGetUserById).not.toHaveBeenCalled();
  });

  it("should retrieve schoolId from Prisma for an admin", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      id: "admin-123",
      user_metadata: {
        role: "admin",
      },
    } as any);

    mockFindUnique.mockResolvedValue({
      schoolId: "school-from-db",
    } as any);

    const result = await getSchoolId();

    expect(result).toBe("school-from-db");

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "admin-123" },
      select: { schoolId: true },
    });
  });

  it("should retrieve schoolId from Prisma for a superadmin", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      id: "superadmin-123",
      user_metadata: {
        role: "superadmin",
      },
    } as any);

    mockFindUnique.mockResolvedValue({
      schoolId: "school-superadmin",
    } as any);

    const result = await getSchoolId();

    expect(result).toBe("school-superadmin");
  });

  it("should use Supabase Admin API if Prisma has no schoolId", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      id: "admin-123",
      user_metadata: {
        role: "admin",
      },
    } as any);

    mockFindUnique.mockResolvedValue({
      schoolId: null,
    } as any);

    mockGetUserById.mockResolvedValue({
      data: {
        user: {
          user_metadata: {
            schoolId: "school-from-supabase",
          },
        },
      },
    } as any);

    const result = await getSchoolId();

    expect(result).toBe("school-from-supabase");
    expect(mockGetUserById).toHaveBeenCalledWith("admin-123");
  });

  it("should check Supabase Admin API for a non-admin without metadata", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      id: "teacher-123",
      user_metadata: {
        role: "teacher",
      },
    } as any);

    mockGetUserById.mockResolvedValue({
      data: {
        user: {
          user_metadata: {
            schoolId: "school-teacher",
          },
        },
      },
    } as any);

    const result = await getSchoolId();

    expect(result).toBe("school-teacher");
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("should return default_school when Supabase Admin API fails", async () => {
    mockGetUserById.mockRejectedValue(
      new Error("Supabase API error")
    );

    const result = await getSchoolId();

    expect(result).toBe("default_school");
  });

  it("should return default_school when authentication fails", async () => {
    mockGetAuthenticatedUser.mockRejectedValue(
      new Error("Authentication error")
    );

    const result = await getSchoolId();

    expect(result).toBe("default_school");
  });

  it("should return default_school when Prisma fails", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      id: "admin-123",
      user_metadata: {
        role: "admin",
      },
    } as any);

    mockFindUnique.mockRejectedValue(
      new Error("Database error")
    );

    const result = await getSchoolId();

    expect(result).toBe("default_school");
  });
});

describe("getSchoolIdFromHeader", () => {
  it("should return the school ID from the header", () => {
    const headers = new Headers({
      "x-school-id": "school-001",
    });

    const result = getSchoolIdFromHeader(headers);

    expect(result).toBe("school-001");
  });

  it("should return default_school when the header is missing", () => {
    const headers = new Headers();

    const result = getSchoolIdFromHeader(headers);

    expect(result).toBe("default_school");
  });

  it("should return default_school when the header is empty", () => {
    const headers = new Headers({
      "x-school-id": "",
    });

    const result = getSchoolIdFromHeader(headers);

    expect(result).toBe("default_school");
  });

  it("should work with a custom object implementing get()", () => {
    const headers = {
      get: jest.fn().mockReturnValue("school-custom"),
    };

    const result = getSchoolIdFromHeader(headers);

    expect(result).toBe("school-custom");
    expect(headers.get).toHaveBeenCalledWith("x-school-id");
  });
});
