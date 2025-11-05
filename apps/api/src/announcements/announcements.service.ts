import { BadRequestException, Injectable } from "@nestjs/common";

import { AnnouncementsRepository } from "./announcements.repository";

import type { CreateAnnouncement, AnnouncementFilters } from "./types/announcement.types";
import type { UUIDType } from "src/common";

@Injectable()
export class AnnouncementsService {
  constructor(private readonly announcementsRepository: AnnouncementsRepository) {}

  async getAllAnnouncements(page?: number, perPage?: number) {
    return await this.announcementsRepository.getAllAnnouncements(page, perPage);
  }

  async getLatestUnreadAnnouncements(userId: UUIDType) {
    return await this.announcementsRepository.getLatestUnreadAnnouncements(userId);
  }

  async getUnreadAnnouncementsCount(userId: UUIDType) {
    const [unreadCount] = await this.announcementsRepository.getUnreadAnnouncementsCount(userId);

    return unreadCount;
  }

  async markAnnouncementAsRead(announcementId: UUIDType, userId: UUIDType) {
    const [readAnnouncements] = await this.announcementsRepository.markAnnouncementAsRead(
      announcementId,
      userId,
    );

    if (!readAnnouncements) {
      throw new BadRequestException("announcements.toast.markAsReadFailed");
    }

    return readAnnouncements;
  }

  async getAnnouncementsForUser(userId: UUIDType, filters?: AnnouncementFilters, page?: number, perPage?: number) {
    return await this.announcementsRepository.getAnnouncementsForUser(userId, filters, page, perPage);
  }

  async createAnnouncement(createAnnouncementData: CreateAnnouncement, authorId: UUIDType) {
    const createAnnouncement = await this.announcementsRepository.createAnnouncement(
      createAnnouncementData,
      authorId,
    );

    if (!createAnnouncement) {
      throw new BadRequestException("announcements.toast.createFailed");
    }

    return createAnnouncement;
  }
}
