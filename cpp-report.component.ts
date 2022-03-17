import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ApiService, LoginService, ModalService } from '../../../core';
import { isNullOrUndefined } from 'util';
import { ExportService  } from '../../shared/';
import { Filtered } from '../../models/Filtered';
import { DatePipe } from '@angular/common';
import { FilteredAndParent } from '../../models/RfSubject';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'cpp-intake-report',
  templateUrl: 'cpp-report.component.html',
  styleUrls: ['cpp-report.component.css']
})
export class CppReportComponent implements OnInit {
  isAdmin: boolean = false;
  disSearch: boolean = false;
  authOrgId: Array<number> = new Array<number>();
  authOrgs: Array<Filtered> = new Array<Filtered>();
  report: Array<MeasureDetail> = new Array<MeasureDetail>();
  total: Total = new Total();
  years: Array<number> = new Array<number>();
  quarter: number = 3;
  year: number = 2021;
  rfSubjectIds: Array<number> = new Array<number>();
  rfSubjectUrl: string = '/data/rfSubjects/';
  rfSubjects: Array<Filtered> = new Array<Filtered>();

  queryParams: InputParams;
  type: number;

  constructor(
    private api: ApiService,
    public modalApi: ModalService,
    public exp: ExportService,
    public _loginService: LoginService,
    public datepipe: DatePipe,
    private activateRoute: ActivatedRoute) {
    if (this._loginService.hasRoles(['ROLE_ADMIN'])) {
      this.isAdmin = true;
    } else {
      this.isAdmin = false;
    }
  }

  ngOnInit(): void {
    this.activateRoute.queryParams
      .subscribe((params) => {
        this.queryParams = params as InputParams
        this.type = +this.queryParams.type;
      });
    this.getRfSubjects();
    this.getAuthOrg();
  }

  getAuthOrg() {
    this.api.query('/data/asvImportAuthOrgContracts/search/findByOrgType', ['projection=filter', 'orgType=12'])
      .subscribe((data: any) => {
        data._embedded.asvImportAuthOrgContracts.forEach((e: any) => {
          this.authOrgs.push(new Filtered(e.uid, e.fullname));
        })
      });
  }

  getRfSubjects() {
    this.rfSubjects = new Array<Filtered>();
    this.api.query(this.rfSubjectUrl, ['projection=filter'])
      .subscribe((data: any) => {
        data._embedded.rfSubjects.forEach((e: any) => {
          this.rfSubjects.push(new Filtered(e.uid, e.name));
        })
      })
  }

  rfSubFilter() {
    this.api.query('/water-usage/getRfSubjectsByOrg', [`orgIds=${this.authOrgId}`])
      .subscribe((data: any) => {
        this.rfSubjects = new Array<Filtered>();
        data.data.forEach((sub: any) => {
          if (sub.uid != null)this.rfSubjects.push(new Filtered(sub.uid, sub.name, sub.code));
        })
      })
  }

  findName(data: Array<Filtered>, id: any) {
    return data.find(e => e.uid == parseInt(id));
  }

  clearForm() {
    this.quarter = 0;
    this.year = 2021;
    this.rfSubjectIds = new Array<number>();
    this.authOrgId = new Array<number>();
    this.getRfSubjects();
  }

  loadData() {
    this.years = new Array<number>();
    this.disSearch = true;
    this.report = new Array<MeasureDetail>();
    this.total = new Total();
    const param = [
      `subjectId=${this.rfSubjectIds}`,
      `year=${this.year}`,
      `type=${this.type}`,
      `bvuId=${this.authOrgId}`
    ];
    this.api.query('/water-usage/getCppAnyReport', param)
      .subscribe((data: any) => {
        data.data.forEach((e: MeasureDetail) => {
          this.report.push(e);
          if (!isNullOrUndefined(e.installYear) && this.years.indexOf(e.installYear) == -1)
            this.years.push(e.installYear);
          this.total.add(e);
        })
      }, (err) => {console.log(err)},
        () => {this.disSearch = false; this.years.sort()})
  }

  exportToExcel() {
    this.exp.excel(document.getElementById('dataTable').innerHTML)
  }

  superFix(n: number, round?: number) {
    if (!isNullOrUndefined(n) && Math.floor(n) != n) {
      let c;
      if (isNaN(n)) return 0;
      if (n.toString().indexOf('e') + 1) {
        c = n.toFixed(+(n.toString().split('e-')[1])).split('.')[1].split('');
      } else {
        c = n.toString().split('.')[1].split('');
      }
      let t0 = '';
      let t1 = 0;
      let t2 = 0;
      c.forEach((i, key) => {
        if (t0 == i) {
          t1++;
          if (key + 1 == c.length) {
            t1 = 0;
          }
        } else {
          if (key + 1 != c.length || key + 1 == c.length && (t0 != '9' && t0 != '0')) {
            t0 = i;
            t1 = 1;
            t2 = key;
          }
          if (key + 1 == c.length && t0 == '0' && c.length <= 10) {
            t1 = 0;
          }
        }
      });
      if (t1 > 1) {
        if (isNullOrUndefined(round))
          return n.toFixed(t2);
        else
          return parseFloat(n.toFixed(t2)).toFixed(round);
      }
      if(isNullOrUndefined(round))
        return n.toFixed(c.length);
      else
        return n.toFixed(round);
    } else {
      return n;
    }
  }

  count(year: number) {
    let res = 0
    if (year == 0) {
      if (this.type != 3) res = this.total.hasDevices / (this.total.names.length - this.total.hasAgreements)
      else if (this.type == 3) res = this.total.hasDevices / (this.total.names.length)
      return res;
    }
    this.years.forEach((yr: number) => {
      if (yr <= year) res += this.total.years.get(yr);
    })
    if (this.type != 3) res = (res + this.total.hasDevices) / (this.total.names.length - this.total.hasAgreements)
    else if (this.type == 3) res = (res + this.total.hasDevices) / (this.total.names.length)
    return res;
  }

}

// cat_asv_usage_target
class Total {
  wus: Array<string> = new Array<string>();
  docNums: Array<string> = new Array<string>();
  names: Array<string> = new Array<string>();
  hasDevices: number = 0;
  noDevices: number = 0;
  hasAgreements: number = 0;
  noAgreements: number = 0;
  years: Map<number, number> = new Map<number, number>();

  add(rep: MeasureDetail) {
    if (this.wus.indexOf(rep.wuName) == -1) this.wus.push(rep.wuName);
    if (this.docNums.indexOf(rep.docNum) == -1) this.docNums.push(rep.docNum);
    if (this.names.indexOf(rep.id.toString()) == -1) this.names.push(rep.id.toString());
    if (!isNullOrUndefined(rep.hasDevice)) rep.hasDevice ? this.hasDevices += 1 : this.noDevices += 1;
    if (!isNullOrUndefined(rep.hasAgreement)) rep.hasAgreement ? this.hasAgreements += 1 : this.noAgreements += 1;
    let val = this.years.get(rep.installYear);
    this.years.set(rep.installYear, isNullOrUndefined(this.years.get(rep.installYear)) ? 1 : val += 1)
    return this;
  }
}

type InputParams = {
  type: number;
}

class MeasureDetail {
  id: number;
  measureId: number;
  name: string;
  npp: string;
  hasDevice: boolean = false;
  hasAgreement: boolean = false;
  installYear: number;
  organId: number;
  organName: string;
  year: number;
  wuId: number;
  wuName: string;
  docId: number;
  docNum: string;
  type: number;
}

