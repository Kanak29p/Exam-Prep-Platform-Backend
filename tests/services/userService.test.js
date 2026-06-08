jest.mock("../../src/db/snowflake", () => ({
  query: jest.fn(),
}));

const { query } = require("../../src/db/snowflake");
const userService = require("../../src/services/userService");

describe("userService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("findByEmail should query and return the first matching user or null", async () => {
    query.mockResolvedValueOnce([{ ID: "123", EMAIL: "test@domain.com", NAME: "Test User" }]);
    const user = await userService.findByEmail("test@domain.com");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.USERDETAILS WHERE EMAIL = ?"),
      ["test@domain.com"]
    );
    expect(user).toEqual({ ID: "123", EMAIL: "test@domain.com", NAME: "Test User" });

    query.mockResolvedValueOnce([]);
    const emptyUser = await userService.findByEmail("none@domain.com");
    expect(emptyUser).toBeNull();
  });

  test("createStudent should insert and return student details", async () => {
    query.mockResolvedValueOnce([]);
    const input = { id: "std_99", name: "Alice", email: "alice@domain.com" };
    const result = await userService.createStudent(input);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO PTE_EXAM_PREP_PLATFORM.PUBLIC.USERDETAILS"),
      ["std_99", "Alice", "alice@domain.com"]
    );
    expect(result).toEqual({ id: "std_99", name: "Alice", email: "alice@domain.com", role: "student" });
  });

  test("listStudents should fetch and map student attributes", async () => {
    const dbRows = [
      {
        ID: "s1", NAME: "Student 1", EMAIL: "s1@domain.com", ROLE: "student",
        SCORE: 80, PLAN: "Premium", STATUS: "active", JOINED: "2026-01-01",
        PHONE: "1234", LOCATION: "US", TARGET_SCORE: 79, EXAM_DATE: "2026-07-07",
        BIO: "Hello", AVATAR: "avatar1.png", COUNTRY: "USA", STATE: "CA", CITY: "LA"
      }
    ];
    query.mockResolvedValueOnce(dbRows);

    const students = await userService.listStudents();
    expect(students[0]).toEqual({
      id: "s1", name: "Student 1", email: "s1@domain.com", role: "student",
      score: 80, plan: "Premium", status: "active", joined: "2026-01-01",
      phone: "1234", location: "US", targetScore: 79, examDate: "2026-07-07",
      bio: "Hello", avatar: "avatar1.png", country: "USA", state: "CA", city: "LA"
    });
  });

  test("updateProfile should update properties, handle score/date conversion and return updated user", async () => {
    query.mockResolvedValueOnce([]); // update query response
    query.mockResolvedValueOnce([{ ID: "s1", NAME: "New Name", TARGET_SCORE: 79 }]); // select query response

    const result = await userService.updateProfile("s1", {
      name: "New Name", phone: "4321", location: "UK", targetScore: "79",
      examDate: "2026-08-08", bio: "Updated", avatar: "avatar2.png",
      country: "UK", state: "Eng", city: "Lon", plan: "Premium"
    });

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("UPDATE PTE_EXAM_PREP_PLATFORM.PUBLIC.USERDETAILS"),
      ["New Name", "4321", "UK", 79, "2026-08-08", "Updated", "avatar2.png", "UK", "Eng", "Lon", "Premium", "s1"]
    );
    expect(result).toEqual({ ID: "s1", NAME: "New Name", TARGET_SCORE: 79 });
  });
});
