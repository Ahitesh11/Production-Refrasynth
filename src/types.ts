export type DepartmentId =
  | 'dgu'
  | 'balling_disc'
  | 'kiln'
  | 'product_house'
  | 'sb3_ground'
  | 'sb3_hopper'
  | 'ppt'
  | 'actual_production'
  | 'campaign_closing'
  | 'parameter'
  | 'rm'
  | 'drop_test';

export interface User {
  username: string;
  type: 'Entry' | 'Mark Done' | 'Admin';
  permissions: Record<string, boolean>;
}

export interface Department {
  id: DepartmentId;
  name: string;
  category: 'Lab' | 'Stock' | 'Process';
  fields: Field[];
}

export interface Field {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'time' | 'datetime-local' | 'select';
  options?: string[];
  hint?: string;
}

export interface Entry {
  id: string;
  departmentId: DepartmentId;
  timestamp: string;
  data: Record<string, any>;
}

export const DEPARTMENTS: Department[] = [
  {
    id: 'dgu',
    name: 'DGU',
    category: 'Lab',
    fields: [
      { name: 'entry_type', label: 'Entry Protocol', type: 'select', options: ['Shift', 'Daily'] },
      { name: 'campaign_no', label: 'Campaign No.', type: 'select', options: [] },
      { name: 'shift', label: 'Shift', type: 'select', options: ['Shift A', 'Shift B', 'Shift C'] },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'al2o3', label: 'Al2O3', type: 'number' },
      { name: 'fe2o3', label: 'Fe2O3', type: 'number' },
      { name: 'tio2', label: 'TiO2', type: 'number' },
      { name: 'loi', label: 'Loi', type: 'number' },
      { name: 'note', label: 'Note', type: 'text' },
      { name: 'fineness_1', label: 'Fineness %1', type: 'number' },
      { name: 'fineness_2', label: 'Fineness %2', type: 'number' },
      { name: 'fineness_3', label: 'Fineness %3', type: 'number' },
      { name: 'fineness_4', label: 'Fineness %4', type: 'number' },
      { name: 'fineness_5', label: 'Fineness %5', type: 'number' },
      { name: 'fineness_6', label: 'Fineness %6', type: 'number' },
      { name: 'fineness_7', label: 'Fineness %7', type: 'number' },
      { name: 'fineness_8', label: 'Fineness %8', type: 'number' },
    ]
  },
  {
    id: 'balling_disc',
    name: 'Balling Disc',
    category: 'Lab',
    fields: [
      { name: 'campaign', label: 'Campaign', type: 'select', options: [] },
      { name: 'shift', label: 'Shift', type: 'select', options: ['Shift A', 'Shift B', 'Shift C'] },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'gbm_h1', label: 'GBM H1', type: 'number' },
      { name: 'gbm_h2', label: 'GBM H2', type: 'number' },
      { name: 'gbm_h3', label: 'GBM H3', type: 'number' },
      { name: 'gbm_h4', label: 'GBM H4', type: 'number' },
      { name: 'gbm_h5', label: 'GBM H5', type: 'number' },
      { name: 'gbm_h6', label: 'GBM H6', type: 'number' },
      { name: 'gbm_h7', label: 'GBM H7', type: 'number' },
      { name: 'gbm_h8', label: 'GBM H8', type: 'number' },
      { name: 'drop_test', label: 'Drop Test', type: 'number' },
      { name: 'al2o3', label: 'Al2O3', type: 'number' },
      { name: 'fe2o3', label: 'Fe2O3', type: 'number' },
      { name: 'tio2', label: 'TiO2', type: 'number' },
      { name: 'loi', label: 'Loi', type: 'number' },
      { name: 'note', label: 'Note', type: 'text' },
    ]
  },
  {
    id: 'kiln',
    name: 'Kiln',
    category: 'Lab',
    fields: [
      { name: 'campaign_no', label: 'Campaign No.', type: 'select', options: [] },
      { name: 'shift', label: 'Shift', type: 'select', options: ['Shift A', 'Shift B', 'Shift C'] },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'entry_type', label: 'Entry Type', type: 'select', options: ['Shift', 'Composite'] },
      { name: 'lbd_h1', label: 'LBD H1', type: 'number' },
      { name: 'lbd_h2', label: 'LBD H2', type: 'number' },
      { name: 'lbd_h3', label: 'LBD H3', type: 'number' },
      { name: 'lbd_h4', label: 'LBD H4', type: 'number' },
      { name: 'lbd_h5', label: 'LBD H5', type: 'number' },
      { name: 'lbd_h6', label: 'LBD H6', type: 'number' },
      { name: 'lbd_h7', label: 'LBD H7', type: 'number' },
      { name: 'lbd_h8', label: 'LBD H8', type: 'number' },
      { name: 'ap_h2', label: 'AP H2', type: 'number' },
      { name: 'ap_h4', label: 'AP H4', type: 'number' },
      { name: 'ap_h6', label: 'AP H6', type: 'number' },
      { name: 'ap_h8', label: 'AP H8', type: 'number' },
      { name: 'bd_h2', label: 'BD H2', type: 'number' },
      { name: 'bd_h4', label: 'BD H4', type: 'number' },
      { name: 'bd_h6', label: 'BD H6', type: 'number' },
      { name: 'bd_h8', label: 'BD H8', type: 'number' },
      { name: 'ap_composite', label: 'AP Composite (24hr)', type: 'number' },
      { name: 'bd_composite', label: 'BD Composite (24hr)', type: 'number' },
      { name: 'lbd_ap_composite', label: 'LBD AP Composite (24hr)', type: 'number' },
      { name: 'lbd_bd_composite', label: 'LBD BD Composite (24hr)', type: 'number' },
      { name: 'note', label: 'Note', type: 'text' },
    ]
  },
  {
    id: 'product_house',
    name: 'Product House',
    category: 'Lab',
    fields: [
      { name: 'campaign_no', label: 'Campaign No.', type: 'select', options: [] },
      { name: 'shift', label: 'Shift', type: 'select', options: ['Shift A', 'Shift B', 'Shift C'] },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'al2o3', label: 'Al2O3', type: 'number' },
      { name: 'fe2o3', label: 'Fe2O3', type: 'number' },
      { name: 'sio2', label: 'SiO2', type: 'number' },
      { name: 'tio2', label: 'TiO2', type: 'number' },
      { name: 'cao', label: 'CaO', type: 'number' },
      { name: 'mgo', label: 'MgO', type: 'number' },
      { name: 'ap', label: 'AP', type: 'number' },
      { name: 'bd', label: 'BD', type: 'number' },
      { name: 'note', label: 'Note', type: 'text' },
    ]
  },
  {
    id: 'sb3_ground',
    name: 'SB3 Ground',
    category: 'Stock',
    fields: [
      { name: 'campaign_no', label: 'Campaign No.', type: 'select', options: [] },
      { name: 'product_name', label: 'Product Name', type: 'select', options: [] },
      { name: 'shift', label: 'Shift', type: 'select', options: ['Shift A', 'Shift B', 'Shift C'] },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'mat1', label: 'Material 1', type: 'select', options: [] },
      { name: 'qty1', label: 'Qty1', type: 'number' },
      { name: 'mat2', label: 'Material 2', type: 'select', options: [] },
      { name: 'qty2', label: 'Qty2', type: 'number' },
      { name: 'mat3', label: 'Material 3', type: 'select', options: [] },
      { name: 'qty3', label: 'Qty3', type: 'number' },
    ]
  },
  {
    id: 'sb3_hopper',
    name: 'SB3 Hopper',
    category: 'Stock',
    fields: [
      { name: 'campaign_no', label: 'Campaign No.', type: 'select', options: [] },
      { name: 'product_name', label: 'Product Name', type: 'select', options: [] },
      { name: 'shift', label: 'Shift', type: 'select', options: ['Shift A', 'Shift B', 'Shift C'] },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'hopper3', label: 'Hopper 3', type: 'number' },
      { name: 'hopper4', label: 'Hopper 4', type: 'number' },
      { name: 'hopper5', label: 'Hopper 5', type: 'number' },
      { name: 'note', label: 'Note', type: 'text' },
    ]
  },
  {
    id: 'ppt',
    name: 'PPT',
    category: 'Stock',
    fields: [
      { name: 'campaign_no', label: 'Campaign No.', type: 'select', options: [] },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'semi_finished_name', label: 'Semi Finished Product Name', type: 'text' },
      { name: 'ispileg_qty', label: 'Ispileg Re-feeded Qty', type: 'number' },
    ]
  },
  {
    id: 'actual_production',
    name: 'Actual Production',
    category: 'Stock',
    fields: [
      { name: 'campaign_no', label: 'Campaign No.', type: 'select', options: [] },
      { name: 'shift', label: 'Shift', type: 'select', options: ['Shift A', 'Shift B', 'Shift C'] },
      { name: 'product_name', label: 'Product Name', type: 'select', options: [] },
      { name: 'date_of_production', label: 'Date Of Production', type: 'date' },
      { name: 'qty', label: 'Qty', type: 'number' },
      { name: 'fuel_qty', label: 'Fuel Qty Used', type: 'number' },
      { name: 'electric_used', label: 'Electric Used', type: 'number' },
      { name: 'remark', label: 'Remark', type: 'text' },
    ]
  },
  {
    id: 'campaign_closing',
    name: 'Campaign Closing',
    category: 'Stock',
    fields: [
      { name: 'campaign_no', label: 'Campaign No.', type: 'select', options: [] },
      { name: 'closure_date', label: 'Date of Closure of kiln', type: 'date' },
      { name: 'shutdown_time', label: 'Shutdown Time', type: 'time' },
      { name: 'calc_date', label: 'Date Of Calculation', type: 'date' },
      { name: 'semi_name', label: 'Semi Finished Name', type: 'text' },
      { name: 'sb3_h1', label: 'SB3 Hopper1', type: 'number' },
      { name: 'sb3_h2', label: 'SB3 Hopper2', type: 'number' },
      { name: 'sb3_h3', label: 'SB3 Hopper3', type: 'number' },
      { name: 'ispileg_qty', label: 'Ispileg Qty', type: 'number' },
      { name: 'ppt_qty', label: 'PPT Qty', type: 'number' },
      { name: 'sb4_qty', label: 'SB4 Qty', type: 'number' },
      { name: 'balling_disc_hopper_qty', label: 'Balling Disc Hopper Qty', type: 'number' },
      { name: 'recovered_loc', label: 'Semi Finished Recovered Location', type: 'text' },
      { name: 'closure_reason', label: 'Reason of Closure of Campaign', type: 'text' },
    ]
  },
  {
    id: 'parameter',
    name: 'Parameter',
    category: 'Process',
    fields: [
      { name: 'campaign_no', label: 'Campaign No.', type: 'select', options: [] },
      { name: 'shift', label: 'Shift', type: 'select', options: ['Shift A', 'Shift B', 'Shift C'] },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'tg_feed', label: 'TG Feed', type: 'number' },
      { name: 'tg_avg_bed', label: 'TG Avg Bed Level', type: 'number' },
      { name: 'tg_rpm', label: 'TG RPM', type: 'number' },
      { name: 'tg_burner_press', label: 'TG Burner Pressure', type: 'number' },
      { name: 'dd1_temp', label: 'DD1 Temperature', type: 'number' },
      { name: 'dd1_press', label: 'DD1 Pressure', type: 'number' },
      { name: 'ph1_temp', label: 'PH1 Temperature', type: 'number' },
      { name: 'ph1_press', label: 'PH1 Pressure', type: 'number' },
      { name: 'ph2_temp', label: 'PH2 Temperature', type: 'number' },
      { name: 'ph2_press', label: 'PH2 Pressure', type: 'number' },
      { name: 'ph2_wb4_temp', label: 'PH2 WB4 Temperature', type: 'number' },
      { name: 'ph2_wb6_temp', label: 'PH2 WB6 Temperature', type: 'number' },
      { name: 'tg_chain_temp', label: 'TG Chain Temperature', type: 'number' },
      { name: 'kiln_rpm', label: 'Kiln RPM', type: 'number' },
      { name: 'kiln_current', label: 'Kiln Current', type: 'number' },
      { name: 'kiln_oil_flow', label: 'Kiln Oil Flow', type: 'number' },
      { name: 'kiln_inlet_temp', label: 'Kiln Inlet Temperature', type: 'number' },
      { name: 'kiln_inlet_press', label: 'Kiln Inlet Pressure', type: 'number' },
      { name: 'kiln_outlet_temp', label: 'Kiln Outlet Temperature', type: 'number' },
      { name: 'kiln_outlet_press', label: 'Kiln Outlet Pressure', type: 'number' },
      { name: 'kiln_flame_temp', label: 'Kiln Flame Temperature', type: 'number' },
      { name: 'cooler_hopper_temp', label: 'Cooler Hopper Temperature', type: 'number' },
      { name: 'blaster_fan_rpm', label: 'Blaster Fan RPM', type: 'number' },
      { name: 'balling_disc_1', label: 'Balling Disc 1', type: 'number' },
      { name: 'balling_disc_2', label: 'Balling Disc 2', type: 'number' },
      { name: 'balling_disc_3', label: 'Balling Disc 3', type: 'number' },
      { name: 'balling_disc_4', label: 'Balling Disc 4', type: 'number' },
      { name: 'balling_disc_bin', label: 'Balling Disc Bin Level', type: 'number' },
      { name: 'proportioning_bin', label: 'Proportioning Bin Level', type: 'number' },
      { name: 'kiln_root_blower', label: 'Kiln Root Blower (02)', type: 'number' },
      { name: 'hr_fan_rpm', label: 'HR Fan RPM', type: 'number' },
      { name: 'hr_fan_current', label: 'HR Fan Current', type: 'number' },
      { name: 'hr_inlet_temp', label: 'HR Inlet Temperature', type: 'number' },
      { name: 'id_fan_rpm', label: 'ID Fan RPM', type: 'number' },
      { name: 'id_fan_current', label: 'ID Fan Current', type: 'number' },
      { name: 'id_fan_inlet_temp', label: 'ID Fan Inlet Temperature', type: 'number' },
      { name: 'id_bag_inlet_press', label: 'ID Bag Filter Inlet Pressure', type: 'number' },
      { name: 'id_bag_outlet_press', label: 'ID Bag Filter Outlet Pressure', type: 'number' },
    ]
  },
  {
    id: 'rm',
    name: 'RM',
    category: 'Process',
    fields: [
      { name: 'unique_no', label: 'Unique No.', type: 'text' },
      { name: 'party_name', label: 'Party Name', type: 'text' },
      { name: 'truck_no', label: 'Truck No.', type: 'text' },
      { name: 'invoice_no', label: 'Invoice No.', type: 'text' },
      { name: 'rm_name', label: 'Raw Material Name', type: 'select', options: [] },
      { name: 'truck_qty', label: 'Truck Qty', type: 'number' },
      { name: 'chemist_name', label: 'Name of Chemist', type: 'text' },
      { name: 'date_of_testing', label: 'Date Of Testing', type: 'date' },
      { name: 'planned', label: 'Planned', type: 'date' },
      { name: 'actual', label: 'Actual', type: 'datetime-local' },
      { name: 'delay', label: 'Delay', type: 'text' },
      { name: 'ad', label: 'AD', type: 'number' },
      { name: 'bd', label: 'BD', type: 'number' },
      { name: 'fineness', label: 'Fineness', type: 'number' },
      { name: 'loi', label: 'Loi', type: 'number' },
      { name: 'moisture', label: 'Moisture', type: 'number' },
      { name: 'remarks_physical', label: 'Remarks', type: 'text' },
      { name: 'planned1', label: 'Planned1', type: 'date' },
      { name: 'actual1', label: 'Actual1', type: 'datetime-local' },
      { name: 'delay1', label: 'Delay1', type: 'text' },
      { name: 'al2o3', label: 'Al2O3', type: 'number' },
      { name: 'fe2o3', label: 'Fe2O3', type: 'number' },
      { name: 'sio2', label: 'SiO2', type: 'number' },
      { name: 'mgo', label: 'MgO', type: 'number' },
      { name: 'tio2', label: 'TiO2', type: 'number' },
      { name: 'cao', label: 'CaO', type: 'number' },
      { name: 'remarks_chemical', label: 'Remarks', type: 'text' },
    ]
  },
  {
    id: 'drop_test',
    name: 'Drop Test',
    category: 'Stock',
    fields: [
      { name: 'campaign_no', label: 'Campaign No.', type: 'select', options: [] },
      { name: 'product_name', label: 'Product Name', type: 'select', options: [] },
      { name: 'shift', label: 'Shift', type: 'select', options: ['Shift A', 'Shift B', 'Shift C'] },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'rm1', label: 'Rm 1', type: 'select', options: [] },
      { name: 'dt1', label: 'Drop Test 1', type: 'number' },
      { name: 'rm2', label: 'Rm 2', type: 'select', options: [] },
      { name: 'dt2', label: 'Drop Test 2', type: 'number' },
      { name: 'rm3', label: 'Rm 3', type: 'select', options: [] },
      { name: 'dt3', label: 'Drop Test 3', type: 'number' },
      { name: 'note', label: 'Note', type: 'text' },
    ]
  }
];
