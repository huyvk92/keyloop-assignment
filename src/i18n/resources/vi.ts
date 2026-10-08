import type { TranslationShape } from './en';

/**
 * Vietnamese UI text (US-015). Same keys as `en.ts`; `satisfies` rejects missing and extra keys.
 * Glossary: dashboard = "bảng điều khiển", inventory/stock = "tồn kho", Aging = "Tồn kho lâu",
 * dealership = "đại lý", action = "hành động", vehicle = "xe", Needs attention = "Cần xử lý",
 * refresh = "làm mới".
 */
export const vi = {
  app: {
    title: 'Bảng điều khiển tồn kho',
    documentTitle: '{{page}} · Bảng điều khiển tồn kho',
  },
  layout: {
    brand: 'Bảng điều khiển tồn kho',
    skipToContent: 'Chuyển đến nội dung chính',
    mainNav: 'Điều hướng chính',
    copyright: '© {{year}}',
  },
  language: {
    label: 'Ngôn ngữ',
  },
  common: {
    loading: 'Đang tải…',
    retry: 'Thử lại',
    backHome: 'Về trang chủ',
    close: 'Đóng',
  },
  errors: {
    boundary: {
      title: 'Đã xảy ra lỗi',
      message: 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.',
      retry: 'Thử lại',
    },
    route: {
      title: 'Rất tiếc',
      status: 'Lỗi {{status}} ({{statusText}})',
      generic: 'Đã xảy ra lỗi khi tải trang này.',
    },
    notFound: {
      title: 'Không tìm thấy trang',
    },
    state: {
      defaultTitle: 'Không thể tải dữ liệu',
    },
    messages: {
      vehicleNotAging: 'Chỉ có thể ghi nhận hành động cho xe tồn kho trên {{days}} ngày.',
      validation: 'Một số trường không hợp lệ.',
      notFound: 'Không tìm thấy nội dung bạn cần. Có thể nội dung này đã bị xóa.',
      network: 'Không thể kết nối với máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.',
      server: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau giây lát.',
      unknown: 'Đã xảy ra lỗi. Vui lòng thử lại.',
    },
  },
  dealerships: {
    selector: {
      label: 'Đại lý',
    },
    loadingOne: 'Đang tải đại lý…',
    loadingList: 'Đang tải danh sách đại lý…',
    loadErrorOne: 'Không thể tải đại lý',
    loadErrorList: 'Không thể tải danh sách đại lý',
    notFound: {
      title: 'Không tìm thấy đại lý',
      description: 'Đại lý này không tồn tại hoặc không còn hoạt động.',
      link: 'Đến bảng điều khiển',
    },
    empty: {
      title: 'Chưa có đại lý nào',
      description: 'Thêm một đại lý để bắt đầu theo dõi tồn kho.',
    },
  },
  inventory: {
    agingBadge: 'Tồn kho lâu',
    attentionBadge: 'Cần xử lý',
    kpis: {
      title: 'Tổng quan tồn kho',
      loadError: 'Không thể tải tổng quan tồn kho',
      total: 'Tổng số xe',
      aging: 'Tồn kho lâu',
      agingPercent: '% tồn kho lâu',
      averageDays: 'Số ngày tồn kho trung bình',
      needsAttention: 'Cần xử lý',
      noValue: 'Không có dữ liệu',
      refreshFailed: 'Không thể làm mới tổng quan tồn kho. Đang hiển thị số liệu tải gần nhất.',
    },
    aging: {
      title: 'Xe tồn kho lâu',
      listLabel: 'Xe tồn kho lâu, cũ nhất trước',
      loading: 'Đang tải xe tồn kho lâu…',
      loadError: 'Không thể tải xe tồn kho lâu',
      empty: {
        title: 'Không có xe tồn kho lâu',
        description: 'Không có xe nào tồn kho quá 90 ngày.',
      },
      viewAll_one: 'Xem {{total}} xe tồn kho lâu',
      viewAll_other: 'Xem tất cả {{total}} xe tồn kho lâu',
      days_one: '{{days}} ngày',
      days_other: '{{days}} ngày',
      refreshFailed: 'Không thể làm mới xe tồn kho lâu. Đang hiển thị dữ liệu tải gần nhất.',
    },
    list: {
      label: 'Danh sách xe',
      loading: 'Đang tải danh sách xe…',
      loadError: 'Không thể tải danh sách xe',
      updating: 'Đang cập nhật…',
      refreshFailed: 'Không thể làm mới danh sách. Đang hiển thị dữ liệu tải gần nhất.',
      empty: {
        title: 'Không có xe tồn kho',
        description: '{{dealership}} hiện không có xe nào trong kho.',
      },
      noMatch: {
        title: 'Không có xe nào khớp với bộ lọc',
        description: 'Hãy thay đổi hoặc xóa bộ lọc.',
        clear: 'Xóa bộ lọc',
      },
    },
    filters: {
      label: 'Lọc xe',
      search: {
        label: 'Tìm kiếm',
        hint: 'Số VIN, mã tồn kho hoặc mẫu xe',
      },
      make: { label: 'Hãng xe', all: 'Tất cả hãng xe' },
      model: { label: 'Mẫu xe', all: 'Tất cả mẫu xe' },
      facets: {
        error: 'Không thể tải danh sách hãng xe và mẫu xe.',
      },
      ageBucket: {
        label: 'Số ngày tồn kho',
        all: 'Tất cả',
        options: {
          '0-30': '0-30 ngày',
          '31-60': '31-60 ngày',
          '61-90': '61-90 ngày',
          'over-90': 'Trên 90 ngày',
        },
      },
      agingOnly: 'Chỉ xe tồn kho lâu (trên 90 ngày)',
      needsAttentionOnly: 'Chỉ xe cần xử lý',
      ageRange: {
        legend: 'Khoảng số ngày tùy chọn',
        min: 'Số ngày tối thiểu',
        max: 'Số ngày tối đa',
        apply: 'Áp dụng khoảng',
        errors: {
          order: 'Số ngày tối thiểu phải nhỏ hơn hoặc bằng số ngày tối đa.',
          invalid: 'Nhập số ngày nguyên từ 0 đến {{max}}.',
        },
      },
      matchCount: {
        filtered_one: '{{total}} xe khớp với bộ lọc',
        filtered_other: '{{total}} xe khớp với bộ lọc',
        all_one: '{{total}} xe trong kho',
        all_other: '{{total}} xe trong kho',
      },
    },
    table: {
      caption: 'Xe tồn kho tại {{dealership}}',
      notAging: 'Chưa tồn kho lâu',
      noAction: 'Chưa có hành động',
      actionMeta: '{{loggedBy}} · {{loggedAt}}',
      view: 'Xem',
      viewLabel: 'Xem {{stockNumber}}',
      header: {
        details: 'Chi tiết',
        stockNumber: 'Mã tồn kho',
        make: 'Hãng xe',
        model: 'Mẫu xe',
        year: 'Đời xe',
        daysInStock: 'Số ngày tồn kho',
        aging: 'Tồn kho lâu',
        currentAction: 'Hành động hiện tại',
        listPrice: 'Giá niêm yết',
        stockInDate: 'Ngày nhập kho',
        mileage: 'Số dặm đã đi',
        trim: 'Phiên bản',
        colour: 'Màu sắc',
        vin: 'Số VIN',
      },
    },
    sort: {
      announcement: 'Đã sắp xếp theo {{column}}, {{order}}',
      keys: {
        age: 'số ngày tồn kho',
        price: 'giá',
        makeModel: 'hãng xe và mẫu xe',
      },
      orders: {
        asc: 'tăng dần',
        desc: 'giảm dần',
      },
      hints: {
        makeModel: 'Sắp xếp theo hãng xe, rồi theo mẫu xe',
      },
    },
    refresh: {
      lastUpdated: 'Cập nhật lúc {{time}}',
      button: 'Làm mới',
      refreshing: 'Đang làm mới…',
    },
    pagination: {
      label: 'Phân trang',
      summary: 'Hiển thị {{from}}-{{to}} / {{total}}',
      page: 'Trang {{page}} / {{lastPage}}',
      previous: 'Trước',
      previousLabel: 'Trang trước',
      next: 'Sau',
      nextLabel: 'Trang sau',
    },
  },
  vehicleActions: {
    dialog: {
      fallbackTitle: 'Chi tiết xe',
      title: '{{stockNumber}} · {{make}} {{model}}',
      loading: 'Đang tải chi tiết xe…',
      loadError: 'Không thể tải thông tin xe này',
      refreshFailed: 'Không thể làm mới thông tin xe. Đang hiển thị dữ liệu tải gần nhất.',
    },
    facts: {
      days_one: '{{days}} ngày',
      days_other: '{{days}} ngày',
    },
    history: {
      title: 'Lịch sử hành động',
      label: 'Lịch sử hành động, mới nhất trước',
      empty: 'Chưa có hành động nào được ghi nhận cho xe này.',
      loggedBy: 'Người ghi nhận: {{name}}',
    },
    form: {
      title: 'Ghi nhận hành động',
      status: 'Trạng thái hành động',
      note: {
        label: 'Ghi chú (không bắt buộc)',
        hint: 'Tối đa {{max}} ký tự.',
        counter: '{{length}} / {{max}}',
      },
      loggedBy: 'Người ghi nhận',
      submit: 'Lưu hành động',
      submitting: 'Đang lưu…',
      saved: 'Đã lưu hành động',
      saveError: 'Không thể lưu hành động',
      notAging:
        'Chỉ có thể ghi nhận hành động cho xe tồn kho trên {{days}} ngày. Lịch sử bên dưới vẫn được hiển thị.',
      errors: {
        statusRequired: 'Vui lòng chọn trạng thái hành động.',
        noteTooLong: 'Ghi chú không được vượt quá {{max}} ký tự.',
        loggedByRequired: 'Vui lòng nhập tên của bạn.',
        loggedByTooLong: 'Tên không được vượt quá {{max}} ký tự.',
        invalid: 'Vui lòng kiểm tra lại trường này.',
      },
    },
  },
  actionStatus: {
    'Price Reduction Planned': 'Dự kiến giảm giá',
    'Marketing Promotion': 'Chạy khuyến mãi',
    'Transfer to Another Dealership': 'Chuyển sang đại lý khác',
    'Send to Auction/Wholesale': 'Đưa đi đấu giá/bán sỉ',
    'Under Review': 'Đang xem xét',
  },
} as const satisfies TranslationShape;
