import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class EstablishmentsDataService {
  async getAddress(zipcode: string): Promise<string> {
    const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zipcode}`);
    const data = await response.json();
  
    if (data.results) {
      const res = data.results[0];
      return `${res.address1}${res.address2}${res.address3}`;
    } else {
      throw new Error('住所が見つかりませんでした');
    }
  }
}
