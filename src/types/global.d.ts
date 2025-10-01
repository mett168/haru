// 📄 src/types/global.d.ts
declare module "next" {
  export interface PageProps {
    params: {
      code: string;
    };
  }
}
