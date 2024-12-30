import axios from "axios";
import {
  IImage,
  IImageCollectionProvider,
  ISearchResult,
} from "./imageProvider";
import logo from "./WikiCommons.png";
interface WikiImageInfo {
  descriptionurl: string;
  url: string;
  thumburl?: string;
  width: number;
  height: number;
  extmetadata?: {
    Artist?: {
      value: string;
    };
    License?: {
      value: string;
    };
    LicenseShortName?: {
      value: string;
    };
  };
}

interface WikiResponse {
  continue?: {
    gimcontinue: string;
  };
  query?: {
    pages?: {
      [key: string]: {
        imageinfo?: WikiImageInfo[];
        title?: string;
      };
    };
  };
}

export class WikipediaProvider implements IImageCollectionProvider {
  public label = "Wikimedia Commons";
  public id = "wikipedia";
  public logo = logo;

  // Wikipedia doesn't have normal paging, so we need these two
  private continueToken: string | undefined;
  private previousQuery: string | undefined; // this is needed to know when we need to reset the continueToken

  public async search(
    searchTerm: string,
    pageZeroIndexed: number,
    language: string
  ): Promise<ISearchResult> {
    try {
      // if we're searching the same thing but the last result had no continueToken, we are done searching
      if (searchTerm === this.previousQuery && !this.continueToken) {
        return { images: [] };
      }

      if (searchTerm !== this.previousQuery) {
        this.continueToken = undefined;
        this.previousQuery = searchTerm;
      }
      const term = encodeURIComponent(searchTerm);
      const limit = 20;
      const continuePart =
        this.continueToken !== undefined && this.continueToken.length > 0
          ? `&gimcontinue=${this.continueToken}`
          : "";
      const response = await axios.get<WikiResponse>(
        `https://commons.wikimedia.org/w/api.php?action=query&generator=images&iiprop=url|thumburl|size|extmetadata` +
          `&prop=imageinfo` +
          `&iiurlwidth=300` +
          `&format=json&origin=*&titles=${term}` +
          `&gimlimit=${limit}` +
          continuePart
      );

      this.continueToken = response.data.continue?.gimcontinue; // will go to undefined when we reach the end
      const pages = response.data.query?.pages || {};
      const images: IImage[] = [];

      Object.values(pages).forEach((page) => {
        if (page.imageinfo?.[0]) {
          const info = page.imageinfo[0];
          const artist =
            info.extmetadata?.Artist?.value?.replace(/<[^>]*>/g, "") || // Remove HTML tags
            undefined;

          images.push({
            thumbnailUrl: info.thumburl || info.url,
            reasonableSizeUrl: info.url,
            webSiteUrl: info.descriptionurl,
            size: 0,
            type: "image",
            width: info.width,
            height: info.height,
            license:
              info.extmetadata?.LicenseShortName?.value ||
              info.extmetadata?.License?.value ||
              "Wikimedia Commons",
            licenseUrl: "https://commons.wikimedia.org/wiki/Commons:Licensing",
            creator: artist,
            raw: info,
          });
        }
      });

      return { images };
    } catch (error) {
      return {
        images: [],
        error: `Error fetching from Wikimedia: ${error}`,
      };
    }
  }
}
