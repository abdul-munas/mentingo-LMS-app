import { Inject, Injectable } from "@nestjs/common";
import {
  eq,
  and,
  getTableColumns,
  countDistinct,
  count,
  isNotNull,
  sql,
  not,
  desc,
  ilike,
  or,
} from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import {
  announcements,
  groupAnnouncements,
  groupUsers,
  userAnnouncements,
  users,
} from "src/storage/schema";
import { S3Service } from "src/s3/s3.service";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { UserService } from "src/user/user.service";

import { LATEST_ANNOUNCEMENTS_LIMIT } from "./consts";

import type {
  Announcement,
  CreateAnnouncement,
  AnnouncementFilters,
} from "./types/announcement.types";
import type { UUIDType } from "src/common";

@Injectable()
export class AnnouncementsRepository {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly userService: UserService,
    private readonly s3Service: S3Service,
  ) {}

  async getAllAnnouncements(page: number = 1, perPage: number = DEFAULT_PAGE_SIZE) {
    const offset = (page - 1) * perPage;

    const announcementsData = await this.db
      .select({
        ...getTableColumns(announcements),
        ...this.getAuthorFields(),
      })
      .from(announcements)
      .leftJoin(users, eq(announcements.authorId, users.id))
      .orderBy(desc(announcements.createdAt))
      .limit(perPage)
      .offset(offset);

    const [{ totalItems }] = await this.db
      .select({ totalItems: count() })
      .from(announcements);

    return {
      data: await this.mapAnnouncementsWithProfilePictures(announcementsData),
      pagination: {
        totalItems,
        page,
        perPage,
      },
    };
  }

  async getLatestUnreadAnnouncements(userId: UUIDType) {
    const announcementsData = await this.db
      .select({
        ...getTableColumns(announcements),
        ...this.getAuthorFields(),
      })
      .from(announcements)
      .leftJoin(
        userAnnouncements,
        and(
          eq(announcements.id, userAnnouncements.announcementId),
          eq(userAnnouncements.userId, userId),
        ),
      )
      .leftJoin(users, eq(announcements.authorId, users.id))
      .where(eq(userAnnouncements.isRead, false))
      .orderBy(desc(announcements.createdAt))
      .limit(LATEST_ANNOUNCEMENTS_LIMIT);

    return await this.mapAnnouncementsWithProfilePictures(announcementsData);
  }

  async getUnreadAnnouncementsCount(userId: UUIDType) {
    return await this.db
      .select({
        unreadCount: countDistinct(announcements.id),
      })
      .from(userAnnouncements)
      .where(and(eq(userAnnouncements.userId, userId), eq(userAnnouncements.isRead, false)));
  }

  async createAnnouncement(createAnnouncementData: CreateAnnouncement, authorId: UUIDType) {
    const { groupId, ...announcementData } = createAnnouncementData;

    const [announcement] = await this.db
      .insert(announcements)
      .values({ ...announcementData, authorId, isEveryone: groupId === null })
      .returning();

    if (groupId) {
      await this.db.insert(groupAnnouncements).values({
        groupId,
        announcementId: announcement.id,
      });

      const usersRelatedToGroup = await this.db
        .select({ userId: groupUsers.userId })
        .from(groupUsers)
        .leftJoin(users, eq(groupUsers.userId, users.id))
        .where(and(eq(groupUsers.groupId, groupId), not(eq(users.role, USER_ROLES.ADMIN))));

      await this.createUserAnnouncementRecords(
        usersRelatedToGroup.map((user) => user.userId),
        announcement.id,
      );

      return announcement;
    }

    const allUserIds = await this.db
      .select({ id: users.id })
      .from(users)
      .where(not(eq(users.id, authorId)));
    await this.createUserAnnouncementRecords(
      allUserIds.map((user) => user.id),
      announcement.id,
    );

    return announcement;
  }

  async markAnnouncementAsRead(announcementId: string, userId: UUIDType) {
    return await this.db
      .update(userAnnouncements)
      .set({ isRead: true })
      .where(
        and(
          eq(userAnnouncements.announcementId, announcementId),
          eq(userAnnouncements.userId, userId),
        ),
      )
      .returning();
  }

  async getAnnouncementsForUser(
    userId: UUIDType,
    filters?: AnnouncementFilters,
    page: number = 1,
    perPage: number = DEFAULT_PAGE_SIZE,
  ) {
    const offset = (page - 1) * perPage;

    const baseQuery = this.db
      .select({
        ...getTableColumns(announcements),
        ...this.getAuthorFields(),
        isRead: userAnnouncements.isRead,
      })
      .from(announcements)
      .leftJoin(
        userAnnouncements,
        and(
          eq(announcements.id, userAnnouncements.announcementId),
          eq(userAnnouncements.userId, userId),
        ),
      )
      .leftJoin(users, eq(announcements.authorId, users.id));

    const filterConditions = this.getFiltersConditions(filters);
    const whereConditions = and(isNotNull(userAnnouncements.userId), ...(filterConditions as any));

    const announcementsData = await baseQuery
      .where(whereConditions)
      .orderBy(desc(announcements.createdAt))
      .limit(perPage)
      .offset(offset);

    const [{ totalItems }] = await this.db
      .select({ totalItems: count() })
      .from(announcements)
      .leftJoin(
        userAnnouncements,
        and(
          eq(announcements.id, userAnnouncements.announcementId),
          eq(userAnnouncements.userId, userId),
        ),
      )
      .leftJoin(users, eq(announcements.authorId, users.id))
      .where(whereConditions);

    return {
      data: await this.mapAnnouncementsWithProfilePictures(announcementsData),
      pagination: {
        totalItems,
        page,
        perPage,
      },
    };
  }

  private getFiltersConditions(filters?: AnnouncementFilters) {
    const conditions = [] as unknown[];

    if (!filters) return [sql`1=1`];

    if (filters.title)
      conditions.push(ilike(announcements.title, `%${filters.title.toLowerCase()}%`));
    if (filters.content)
      conditions.push(ilike(announcements.content, `%${filters.content.toLowerCase()}%`));
    if (filters.isRead !== undefined) conditions.push(eq(userAnnouncements.isRead, filters.isRead));
    if (filters.authorName)
      conditions.push(
        or(
          ilike(users.firstName, `%${filters.authorName.toLowerCase()}%`),
          ilike(users.lastName, `%${filters.authorName.toLowerCase()}%`),
        ),
      );
    if (filters.search)
      conditions.push(
        or(
          ilike(announcements.title, `%${filters.search.toLowerCase()}%`),
          ilike(announcements.content, `%${filters.search.toLowerCase()}%`),
        ),
      );

    return conditions.length ? conditions : [sql`1=1`];
  }

  async createUserAnnouncementRecords(userIds: UUIDType[], announcementId: UUIDType) {
    if (!userIds.length) return;

    const userAnnouncementsToInsert = userIds.map((userId) => ({
      userId,
      announcementId,
      isRead: false,
    }));

    await this.db.insert(userAnnouncements).values(userAnnouncementsToInsert);
  }

  getAuthorFields() {
    return {
      authorName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
      authorProfilePictureUrl: users.avatarReference,
    };
  }

  async mapAnnouncementsWithProfilePictures(announcementsData: Announcement[]) {
    // Batch fetch all author profile pictures at once (optimized to prevent N+1 queries)
    const avatarKeys = announcementsData
      .map((announcement) => announcement.authorProfilePictureUrl)
      .filter((key): key is string => !!key);

    const avatarUrls = avatarKeys.length > 0 ? await this.s3Service.getSignedUrls(avatarKeys) : {};

    return announcementsData.map((announcement) => ({
      ...announcement,
      authorProfilePictureUrl: announcement.authorProfilePictureUrl
        ? avatarUrls[announcement.authorProfilePictureUrl] || null
        : null,
    }));
  }
}
