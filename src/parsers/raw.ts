/**
 * Zod schemas for raw GraphQL responses. Each schema validates just enough
 * of the response shape for parsers to safely extract data. Unknown fields
 * pass through via `.passthrough()` so Airbnb adding new fields won't break us.
 */
import { z } from "zod";

// ── StaysSearch ──────────────────────────────────────────────────────────────

const SearchResultRaw = z
  .object({
    __typename: z.string().optional(),
    id: z.string().optional(),
    title: z.string().optional(),
    demandStayListing: z
      .object({
        id: z.string(),
        description: z
          .object({
            name: z
              .object({
                localizedStringWithTranslationPreference: z.string().optional(),
              })
              .optional(),
          })
          .optional(),
        location: z
          .object({
            coordinate: z
              .object({
                latitude: z.number().optional(),
                longitude: z.number().optional(),
              })
              .optional(),
          })
          .optional(),
      })
      .passthrough()
      .optional(),
    structuredDisplayPrice: z
      .object({
        primaryLine: z
          .object({
            price: z.string().optional(),
            originalPrice: z.string().optional(),
            discountedPrice: z.string().optional(),
            qualifier: z.string().optional(),
            secondaryLine: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    avgRatingLocalized: z.string().optional(),
    badges: z
      .array(
        z
          .object({
            loggingContext: z
              .object({
                badgeType: z.string().optional(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough(),
      )
      .optional(),
    contextualPictures: z
      .array(
        z
          .object({
            picture: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const staysSearchRaw = z
  .object({
    data: z
      .object({
        presentation: z
          .object({
            staysSearch: z
              .object({
                results: z
                  .object({
                    searchResults: z.array(SearchResultRaw),
                    paginationInfo: z
                      .object({
                        nextPageCursor: z.string().nullable().optional(),
                      })
                      .passthrough()
                      .optional(),
                  })
                  .passthrough(),
              })
              .passthrough(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

export type StaysSearchRaw = z.infer<typeof staysSearchRaw>;

// ── StaysPdpSections (price) ─────────────────────────────────────────────────

export const staysPdpRaw = z
  .object({
    data: z
      .object({
        presentation: z
          .object({
            stayProductDetailPage: z
              .object({
                sections: z
                  .object({
                    sections: z
                      .array(
                        z
                          .object({
                            sectionId: z.string().optional(),
                            localizedUnavailabilityMessage: z.string().optional(),
                            structuredDisplayPrice: z
                              .object({
                                primaryLine: z
                                  .object({
                                    price: z.string().optional(),
                                    originalPrice: z.string().optional(),
                                    discountedPrice: z.string().optional(),
                                    qualifier: z.string().optional(),
                                  })
                                  .passthrough()
                                  .optional(),
                                explanationData: z
                                  .object({
                                    priceDetails: z.array(z.unknown()).optional(),
                                  })
                                  .passthrough()
                                  .optional(),
                              })
                              .passthrough()
                              .optional(),
                          })
                          .passthrough(),
                      )
                      .optional(),
                  })
                  .passthrough(),
              })
              .passthrough(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

export type StaysPdpSectionsRaw = z.infer<typeof staysPdpRaw>;

// ── StaysPdpReviewsQuery ─────────────────────────────────────────────────────

export const staysReviewsRaw = z
  .object({
    data: z
      .object({
        presentation: z
          .object({
            stayProductDetailPage: z
              .object({
                reviews: z
                  .object({
                    reviews: z
                      .array(
                        z
                          .object({
                            id: z.string().optional(),
                            ratingLocalized: z.string().optional(),
                            createdAt: z.string().optional(),
                            comments: z.string().optional(),
                            text: z.string().optional(),
                            language: z.string().optional(),
                            reviewer: z
                              .object({
                                name: z.string().optional(),
                                id: z.string().optional(),
                              })
                              .passthrough()
                              .optional(),
                            responses: z.array(z.unknown()).optional(),
                          })
                          .passthrough(),
                      )
                      .optional(),
                  })
                  .passthrough(),
              })
              .passthrough(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

export type StaysPdpReviewsQueryRaw = z.infer<typeof staysReviewsRaw>;

// ── PdpAvailabilityCalendar (data.merlin) ────────────────────────────────────

export const pdpCalendarRaw = z
  .object({
    data: z
      .object({
        merlin: z
          .object({
            pdpAvailabilityCalendar: z
              .object({
                calendarMonths: z
                  .array(
                    z
                      .object({
                        month: z.number().optional(),
                        year: z.number().optional(),
                        days: z
                          .array(
                            z
                              .object({
                                date: z.string().optional(),
                                available: z.boolean().optional(),
                                priceString: z.string().optional(),
                                price: z.string().optional(),
                                minNights: z.number().optional(),
                              })
                              .passthrough(),
                          )
                          .optional(),
                      })
                      .passthrough(),
                  )
                  .optional(),
              })
              .passthrough(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

export type PdpAvailabilityCalendarRaw = z.infer<typeof pdpCalendarRaw>;

// ── GetUserProfile ───────────────────────────────────────────────────────────

export const getUserProfileRaw = z
  .object({
    data: z
      .object({
        presentation: z
          .object({
            user: z
              .object({
                id: z.string().optional(),
                name: z.string().optional(),
                about: z.string().optional(),
                location: z.string().optional(),
                isSuperhost: z.boolean().optional(),
                responseRate: z.number().optional(),
                responseTimeSeconds: z.number().optional(),
                listingsCount: z.number().optional(),
              })
              .passthrough(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

export type GetUserProfileRaw = z.infer<typeof getUserProfileRaw>;

// ── UserProfileBeehiveListingQuery ───────────────────────────────────────────

export const beehiveListingsRaw = z
  .object({
    data: z
      .object({
        beehive: z
          .object({
            getListOfListings: z
              .object({
                listings: z.array(z.unknown()).optional(),
              })
              .passthrough(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

export type UserProfileBeehiveListingQueryRaw = z.infer<typeof beehiveListingsRaw>;

// ── ExperiencesSearch ────────────────────────────────────────────────────────

export const experiencesSearchRaw = z
  .object({
    data: z
      .object({
        presentation: z
          .object({
            experiencesSearch: z
              .object({
                results: z
                  .object({
                    searchResults: z
                      .array(
                        z
                          .object({
                            id: z.string().optional(),
                            title: z.string().optional(),
                            avgRatingLocalized: z.string().optional(),
                            contextualPictures: z
                              .array(
                                z
                                  .object({
                                    picture: z.string().optional(),
                                  })
                                  .passthrough(),
                              )
                              .optional(),
                            priceString: z.string().optional(),
                            price: z.string().optional(),
                            duration: z.string().optional(),
                            category: z.string().optional(),
                          })
                          .passthrough(),
                      )
                      .optional(),
                    paginationInfo: z
                      .object({
                        nextPageCursor: z.string().nullable().optional(),
                      })
                      .passthrough()
                      .optional(),
                  })
                  .passthrough(),
              })
              .passthrough(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

export type ExperiencesSearchRaw = z.infer<typeof experiencesSearchRaw>;
